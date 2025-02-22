// lib/db/managers/trackingDatabaseManager.ts
import { BaseDatabaseManager } from './baseDatabaseManager';
import type { Aircraft } from '@/types/base';

interface DatabaseState {
  isReady: boolean;
  tables: string[];
  cacheStatus: {
    manufacturersAge: number | null;
    icaosAge: number | null;
  };
}

class TrackingDatabaseManager extends BaseDatabaseManager {
  private static instance: TrackingDatabaseManager | null = null;

  private constructor() {
    if (typeof window !== 'undefined') {
      throw new Error(
        'TrackingDatabaseManager cannot be used on the client side'
      );
    }

    const resolvedDbPath =
      'c:\\users\\satho\\documents\\projects\\aircraft-tracking\\lib\\db\\tracking.db';
    super(resolvedDbPath);
  }

  public async getDatabaseState(): Promise<DatabaseState> {
    try {
      // Get list of tables
      const tables = !this.db
        ? []
        : await this.executeQuery<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type='table'"
          ).then((results) => results.map((r) => r.name));

      console.log('[TrackingDB] Current tables:', tables);

      // Check if required tables exist
      const hasRequiredTables = tables.includes('tracked_aircraft');

      return {
        isReady: this.isReady && hasRequiredTables,
        tables,
        cacheStatus: {
          manufacturersAge: null, // TrackingDB doesn't cache manufacturers
          icaosAge: null, // TrackingDB doesn't cache ICAOs
        },
      };
    } catch (error) {
      console.error('[TrackingDB] Failed to get database state:', error);
      return {
        isReady: false,
        tables: [],
        cacheStatus: {
          manufacturersAge: null,
          icaosAge: null,
        },
      };
    }
  }

  // Add this method to check database connectivity
  public async checkConnection(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      await this.executeQuery('SELECT 1');
      return true;
    } catch (error) {
      console.error('[TrackingDB] Connection check failed:', error);
      return false;
    }
  }

  protected async createTables(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS tracked_aircraft (
        icao24 TEXT PRIMARY KEY,
        manufacturer TEXT,
        model TEXT,
        latitude REAL,
        longitude REAL,
        altitude REAL,
        velocity REAL,
        heading REAL,
        on_ground INTEGER,
        last_contact INTEGER,
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        "N-NUMBER" TEXT,
        NAME TEXT,
        CITY TEXT,
        STATE TEXT,
        TYPE_AIRCRAFT TEXT,
        OWNER_TYPE TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_tracked_aircraft_manufacturer 
        ON tracked_aircraft(manufacturer);
      CREATE INDEX IF NOT EXISTS idx_tracked_aircraft_last_contact 
        ON tracked_aircraft(last_contact);
    `);

    console.log('[TrackingDB] ✅ Tables and indices created successfully');
  }

  public async getTrackedICAOs(): Promise<string[]> {
    await this.ensureInitialized();
    const activeThreshold = Math.floor(Date.now() / 1000) - 2 * 60 * 60; // 2 hours

    try {
      const query = `
      SELECT DISTINCT icao24 
      FROM tracked_aircraft 
      WHERE last_contact > ?
      ORDER BY icao24
    `;

      const rows = await this.executeQuery<{ icao24: string }>(query, [
        activeThreshold,
      ]);
      console.log(`[TrackingDB] Found ${rows.length} active ICAOs`);

      return rows.map((row) => row.icao24);
    } catch (error) {
      console.error('[TrackingDB] Failed to fetch tracked ICAOs:', error);
      throw error;
    }
  }

  public async getTrackedAircraft(manufacturer?: string): Promise<Aircraft[]> {
    await this.ensureInitialized();
    const activeThreshold = Math.floor(Date.now() / 1000) - 2 * 60 * 60; // 2 hours

    try {
      let query = `
        SELECT * FROM tracked_aircraft 
        WHERE last_contact > ? 
      `;
      const params: any[] = [activeThreshold];

      if (manufacturer) {
        query += ` AND LOWER(manufacturer) = LOWER(?)`;
        params.push(manufacturer);
      }

      console.log('[TrackingDB] Fetching tracked aircraft:', {
        manufacturer: manufacturer || 'all',
        threshold: activeThreshold,
        query,
      });

      const rows = await this.executeQuery<Aircraft>(query, params);

      console.log('[TrackingDB] Found tracked aircraft:', {
        count: rows.length,
        sample: rows.slice(0, 2).map((a) => a.icao24),
      });

      return rows.map((row) => ({
        ...row,
        isTracked: true,
        lastSeen: Date.now(),
        on_ground: Boolean(row.on_ground),
      }));
    } catch (error) {
      console.error('[TrackingDB] Failed to get tracked aircraft:', error);
      throw error;
    }
  }

  public async getAircraftByIcao24(
    icao24s: string[],
    manufacturer?: string
  ): Promise<Aircraft[]> {
    await this.ensureInitialized();

    if (!icao24s.length) {
      return [];
    }

    const placeholders = icao24s.map(() => '?').join(',');
    const params = manufacturer ? [...icao24s, manufacturer] : icao24s;
    const activeThreshold = Math.floor(Date.now() / 1000) - 2 * 60 * 60; // 2 hours

    const query = `
      SELECT * FROM tracked_aircraft 
      WHERE icao24 IN (${placeholders})
      AND last_contact > ?
      ${manufacturer ? 'AND LOWER(manufacturer) = LOWER(?)' : ''}
    `;

    return this.executeQuery<Aircraft>(query, [...params, activeThreshold]);
  }

  public async upsertActiveAircraftBatch(
    aircraftData: Aircraft[]
  ): Promise<number> {
    await this.ensureInitialized();

    try {
      await this.executeQuery('BEGIN TRANSACTION');

      for (const aircraft of aircraftData) {
        await this.executeQuery(
          `INSERT INTO tracked_aircraft (
            icao24, manufacturer, model, "N-NUMBER", latitude, longitude,
            altitude, velocity, heading, on_ground, last_contact,
            TYPE_AIRCRAFT, NAME, CITY, STATE, OWNER_TYPE, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(icao24) DO UPDATE SET
            manufacturer = COALESCE(excluded.manufacturer, tracked_aircraft.manufacturer),
            model = COALESCE(NULLIF(excluded.model, ''), tracked_aircraft.model),
            latitude = excluded.latitude,
            longitude = excluded.longitude,
            altitude = excluded.altitude,
            velocity = excluded.velocity,
            heading = excluded.heading,
            on_ground = excluded.on_ground,
            last_contact = excluded.last_contact,
            updated_at = excluded.updated_at`,
          [
            aircraft.icao24,
            aircraft.manufacturer || '',
            aircraft.model || '',
            aircraft['N-NUMBER'] || '',
            aircraft.latitude,
            aircraft.longitude,
            aircraft.altitude || 0,
            aircraft.velocity || 0,
            aircraft.heading || 0,
            aircraft.on_ground ? 1 : 0,
            Math.floor(Date.now() / 1000),
            aircraft.TYPE_AIRCRAFT || '',
            aircraft.NAME || '',
            aircraft.CITY || '',
            aircraft.STATE || '',
            aircraft.OWNER_TYPE || '',
            Math.floor(Date.now() / 1000),
          ]
        );
      }

      await this.executeQuery('COMMIT');
      return aircraftData.length;
    } catch (error) {
      await this.executeQuery('ROLLBACK');
      console.error('[TrackingDB] Failed to upsert aircraft batch:', error);
      throw error;
    }
  }

  // In TrackingDatabaseManager class
  public async updatePosition(
    icao24: string,
    latitude: number,
    longitude: number,
    heading: number,
    altitude?: number,
    velocity?: number,
    on_ground?: boolean
  ): Promise<void> {
    await this.ensureInitialized();

    try {
      const sql = `
      UPDATE tracked_aircraft 
      SET latitude = ?,
          longitude = ?,
          heading = ?,
          altitude = COALESCE(?, altitude),
          velocity = COALESCE(?, velocity),
          on_ground = COALESCE(?, on_ground),
          updated_at = strftime('%s', 'now')
      WHERE icao24 = ?
    `;

      await this.executeQuery(sql, [
        latitude,
        longitude,
        heading,
        altitude,
        velocity,
        on_ground,
        icao24,
      ]);
    } catch (error) {
      console.error('[TrackingDB] Failed to update position:', error);
      throw error;
    }
  }

  public async performMaintenance(): Promise<{ cleanedRecords: number }> {
    await this.ensureInitialized();

    try {
      await this.executeQuery('BEGIN TRANSACTION');

      // Clean up stale records (older than 2 hours)
      const staleThreshold = Math.floor(Date.now() / 1000) - 2 * 60 * 60;

      const result = await this.executeQuery<{ changes: number }>(
        `DELETE FROM tracked_aircraft 
         WHERE last_contact < ? 
         RETURNING changes()`,
        [staleThreshold]
      );

      // Optimize database
      await this.executeQuery('PRAGMA optimize');
      await this.executeQuery('VACUUM');
      await this.executeQuery('ANALYZE');

      await this.executeQuery('COMMIT');

      return {
        cleanedRecords: result[0]?.changes || 0,
      };
    } catch (error) {
      await this.executeQuery('ROLLBACK');
      console.error('[TrackingDB] Maintenance failed:', error);
      throw error;
    }
  }

  public static getInstance(): TrackingDatabaseManager {
    if (!TrackingDatabaseManager.instance) {
      TrackingDatabaseManager.instance = new TrackingDatabaseManager();
    }
    return TrackingDatabaseManager.instance;
  }
}

const trackingDatabaseManager = TrackingDatabaseManager.getInstance();
export { TrackingDatabaseManager };
export default trackingDatabaseManager;
