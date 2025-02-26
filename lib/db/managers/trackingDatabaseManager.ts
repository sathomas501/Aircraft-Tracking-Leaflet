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
  counts: {
    pending: number;
    active: number;
    stale: number;
    total: number;
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

  // Inside your TrackingDatabaseManager class
  public static getInstance(): TrackingDatabaseManager {
    if (!TrackingDatabaseManager.instance) {
      TrackingDatabaseManager.instance = new TrackingDatabaseManager();
    }
    return TrackingDatabaseManager.instance;
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

      // Get counts for different status types
      let pendingCount = 0;
      let activeCount = 0;
      let staleCount = 0;

      if (this.db && hasRequiredTables) {
        const pendingResult = await this.executeQuery<{ count: number }>(
          "SELECT COUNT(*) as count FROM tracked_aircraft WHERE status = 'pending'"
        );
        pendingCount = pendingResult[0]?.count || 0;

        const activeResult = await this.executeQuery<{ count: number }>(
          "SELECT COUNT(*) as count FROM tracked_aircraft WHERE status = 'active'"
        );
        activeCount = activeResult[0]?.count || 0;

        const staleResult = await this.executeQuery<{ count: number }>(
          "SELECT COUNT(*) as count FROM tracked_aircraft WHERE status = 'stale'"
        );
        staleCount = staleResult[0]?.count || 0;
      }

      return {
        isReady: this.isReady && hasRequiredTables,
        tables,
        cacheStatus: {
          manufacturersAge: null, // TrackingDB doesn't cache manufacturers
          icaosAge: null, // TrackingDB doesn't cache ICAOs
        },
        counts: {
          pending: pendingCount,
          active: activeCount,
          stale: staleCount,
          total: pendingCount + activeCount + staleCount,
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
        counts: {
          pending: 0,
          active: 0,
          stale: 0,
          total: 0,
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
        OWNER_TYPE TEXT,
        pending
      );

      CREATE INDEX IF NOT EXISTS idx_tracked_aircraft_manufacturer 
        ON tracked_aircraft(manufacturer);
      CREATE INDEX IF NOT EXISTS idx_tracked_aircraft_last_contact 
        ON tracked_aircraft(last_contact);
    `);

    console.log('[TrackingDB] ✅ Tables and indices created successfully');
  }

  /**
   * Add aircraft to tracking with 'pending' status
   */
  public async addPendingAircraft(
    icao24s: string[],
    manufacturer: string
  ): Promise<number> {
    if (!icao24s.length) {
      console.log('[TrackingDB] No aircraft to add as pending');
      return 0;
    }

    await this.ensureInitialized();
    const currentTime = Math.floor(Date.now() / 1000);

    try {
      console.log(
        `[TrackingDB] Adding ${icao24s.length} aircraft as pending for ${manufacturer}`
      );

      let successCount = 0;

      // Prepare the statement
      if (!this.db) {
        throw new Error('[TrackingDB] Database connection not initialized');
      }

      const stmt = await this.db.prepare(`
      INSERT INTO tracked_aircraft (
        icao24, manufacturer, status, latitude, longitude,
        altitude, velocity, heading, on_ground, last_contact, updated_at
      ) VALUES (?, ?, 'pending', 0, 0, 0, 0, 0, 1, ?, ?)
      ON CONFLICT(icao24) DO UPDATE SET
        manufacturer = COALESCE(excluded.manufacturer, tracked_aircraft.manufacturer),
        status = 'pending',
        updated_at = excluded.updated_at
    `);

      // Process aircraft
      for (const icao24 of icao24s) {
        try {
          await stmt.run(
            icao24,
            manufacturer,
            currentTime - 48 * 60 * 60, // Old timestamp to make it stale
            currentTime
          );
          successCount++;
        } catch (error) {
          console.error(
            `[TrackingDB] Error adding pending aircraft ${icao24}:`,
            error
          );
        }
      }

      // Finalize statement
      await stmt.finalize();

      console.log(
        `[TrackingDB] ✅ Successfully added ${successCount} pending aircraft`
      );
      return successCount;
    } catch (error) {
      console.error('[TrackingDB] Failed to add pending aircraft:', error);
      throw error;
    }
  }

  /**
   * Get all pending aircraft that need position data
   */
  public async getPendingIcao24s(manufacturer?: string): Promise<string[]> {
    await this.ensureInitialized();

    try {
      let query = `
      SELECT DISTINCT icao24 
      FROM tracked_aircraft 
      WHERE status = 'pending'
      AND icao24 IS NOT NULL
    `;

      const params: any[] = [];

      if (manufacturer) {
        query += ` AND manufacturer = ?`;
        params.push(manufacturer);
      }

      const rows = await this.executeQuery<{ icao24: string }>(query, params);
      console.log(
        `[TrackingDB] Found ${rows.length} pending ICAOs${manufacturer ? ` for ${manufacturer}` : ''}`
      );

      return rows.map((row) => row.icao24);
    } catch (error) {
      console.error('[TrackingDB] Failed to fetch pending ICAOs:', error);
      return [];
    }
  }

  /**
   * Get truly active aircraft with recent position data
   */
  public async getActiveIcao24s(manufacturer?: string): Promise<string[]> {
    await this.ensureInitialized();

    // Active means status='active' and recent timestamp
    const activeThreshold = Math.floor(Date.now() / 1000) - 30 * 60; // 30 minutes

    try {
      let query = `
      SELECT DISTINCT icao24 
      FROM tracked_aircraft 
      WHERE status = 'active'
      AND last_contact > ?
      AND icao24 IS NOT NULL
      AND latitude != 0 AND longitude != 0
    `;

      const params: any[] = [activeThreshold];

      if (manufacturer) {
        query += ` AND manufacturer = ?`;
        params.push(manufacturer);
      }

      const rows = await this.executeQuery<{ icao24: string }>(query, params);
      console.log(
        `[TrackingDB] Found ${rows.length} active ICAOs${manufacturer ? ` for ${manufacturer}` : ''}`
      );

      return rows.map((row) => row.icao24);
    } catch (error) {
      console.error('[TrackingDB] Failed to fetch active ICAOs:', error);
      return [];
    }
  }

  /**
   * Get stale aircraft that need refreshing
   */
  public async getStaleIcao24s(manufacturer?: string): Promise<string[]> {
    await this.ensureInitialized();

    // Stale means older than 30 minutes but newer than 24 hours
    const staleStart = Math.floor(Date.now() / 1000) - 24 * 60 * 60; // 24 hours ago
    const staleEnd = Math.floor(Date.now() / 1000) - 30 * 60; // 30 minutes ago

    try {
      let query = `
      SELECT DISTINCT icao24 
      FROM tracked_aircraft 
      WHERE status = 'active'
      AND last_contact > ? AND last_contact < ?
      AND icao24 IS NOT NULL
    `;

      const params: any[] = [staleStart, staleEnd];

      if (manufacturer) {
        query += ` AND manufacturer = ?`;
        params.push(manufacturer);
      }

      const rows = await this.executeQuery<{ icao24: string }>(query, params);
      console.log(
        `[TrackingDB] Found ${rows.length} stale ICAOs${manufacturer ? ` for ${manufacturer}` : ''}`
      );

      return rows.map((row) => row.icao24);
    } catch (error) {
      console.error('[TrackingDB] Failed to fetch stale ICAOs:', error);
      return [];
    }
  }

  /**
   * Mark aircraft as active with position data
   */
  public async markAsActive(
    icao24: string,
    latitude: number,
    longitude: number,
    altitude: number = 0,
    velocity: number = 0,
    heading: number = 0,
    on_ground: boolean = false
  ): Promise<boolean> {
    await this.ensureInitialized();

    const currentTime = Math.floor(Date.now() / 1000);

    try {
      const query = `
      UPDATE tracked_aircraft
      SET 
        status = 'active',
        latitude = ?,
        longitude = ?,
        altitude = ?,
        velocity = ?,
        heading = ?,
        on_ground = ?,
        last_contact = ?,
        updated_at = ?
      WHERE icao24 = ?
    `;

      await this.executeQuery(query, [
        latitude,
        longitude,
        altitude,
        velocity,
        heading,
        on_ground ? 1 : 0,
        currentTime,
        currentTime,
        icao24,
      ]);

      return true;
    } catch (error) {
      console.error(
        `[TrackingDB] Failed to mark aircraft ${icao24} as active:`,
        error
      );
      return false;
    }
  }

  /**
   * Perform maintenance to clean up and mark stale aircraft
   */
  public async performMaintenance(): Promise<{
    cleaned: number;
    marked: number;
  }> {
    await this.ensureInitialized();

    try {
      await this.executeQuery('BEGIN TRANSACTION');

      // Mark old active aircraft as stale
      const staleThreshold = Math.floor(Date.now() / 1000) - 30 * 60; // 30 minutes
      const markStaleResult = await this.executeQuery<{ changes: number }>(
        `UPDATE tracked_aircraft 
       SET status = 'stale' 
       WHERE status = 'active' AND last_contact < ?
       RETURNING changes()`,
        [staleThreshold]
      );

      // Delete very old stale records
      const deleteThreshold = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60; // 7 days
      const deleteResult = await this.executeQuery<{ changes: number }>(
        `DELETE FROM tracked_aircraft 
       WHERE status = 'stale' AND last_contact < ?
       RETURNING changes()`,
        [deleteThreshold]
      );

      await this.executeQuery('COMMIT');

      return {
        marked: markStaleResult[0]?.changes || 0,
        cleaned: deleteResult[0]?.changes || 0,
      };
    } catch (error) {
      await this.executeQuery('ROLLBACK');
      console.error('[TrackingDB] Maintenance failed:', error);
      throw error;
    }
  }

  public async updateAircraftStatus(): Promise<void> {
    await this.ensureInitialized();

    console.log('[TrackingDB] 🔄 Updating aircraft statuses...');

    try {
      const now = Math.floor(Date.now() / 1000); // Current timestamp
      const activeThreshold = now - 600; // 10 minutes for active
      const staleThreshold = now - 3600; // 1 hour for stale

      await this.executeQuery(
        `
      UPDATE tracked_aircraft
      SET status = 
        CASE 
          WHEN last_contact >= ? THEN 'active'
          WHEN last_contact >= ? THEN 'stale'
          ELSE 'pending'
        END
    `,
        [activeThreshold, staleThreshold]
      );

      console.log('[TrackingDB] ✅ Aircraft statuses updated.');
    } catch (error) {
      console.error(
        '[TrackingDB] ❌ Failed to update aircraft statuses:',
        error
      );
      throw error;
    }
  }

  /**
   * Updated version of upsertActiveAircraftBatch to use the status field
   */
  public async upsertActiveAircraftBatch(
    aircraftData: Aircraft[]
  ): Promise<number> {
    if (!aircraftData.length) {
      console.log('[TrackingDB] No aircraft to upsert');
      return 0;
    }

    await this.ensureInitialized();
    let transactionStarted = false;

    try {
      const transactionStatus = await this.db?.get('PRAGMA transaction_status');
      const isInTransaction =
        transactionStatus && transactionStatus.transaction_status !== 0;

      if (!isInTransaction) {
        console.log('[TrackingDB] Starting new transaction');
        await this.executeQuery('BEGIN TRANSACTION');
        transactionStarted = true;
      } else {
        console.log('[TrackingDB] Using existing transaction');
      }

      let successCount = 0;

      if (!this.db) {
        throw new Error('[TrackingDB] Database connection not initialized');
      }

      const stmt = await this.db.prepare(`
      INSERT INTO tracked_aircraft (
        icao24, manufacturer, model, "N-NUMBER", latitude, longitude,
        altitude, velocity, heading, on_ground, last_contact,
        TYPE_AIRCRAFT, NAME, CITY, STATE, OWNER_TYPE, updated_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
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
        updated_at = excluded.updated_at,
        status = 'active'
    `);

      for (const aircraft of aircraftData) {
        try {
          await stmt.run(
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
            Math.floor(Date.now() / 1000)
          );
          successCount++;
        } catch (insertError) {
          console.error(
            `[TrackingDB] Error inserting aircraft ${aircraft.icao24}:`,
            insertError
          );
        }
      }

      await stmt.finalize();

      if (transactionStarted) {
        console.log('[TrackingDB] Committing transaction');
        await this.executeQuery('COMMIT');
      }

      console.log(
        `[TrackingDB] ✅ Successfully upserted ${successCount} aircraft as active`
      );
      return successCount;
    } catch (error) {
      console.error('[TrackingDB] Failed to upsert aircraft batch:', error);

      if (transactionStarted) {
        try {
          console.log('[TrackingDB] Rolling back transaction');
          await this.executeQuery('ROLLBACK');
        } catch (rollbackError) {
          console.error('[TrackingDB] Rollback failed:', rollbackError);
        }
      }

      throw error;
    }
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
}

const trackingDatabaseManager = TrackingDatabaseManager.getInstance();
export { TrackingDatabaseManager };
export default trackingDatabaseManager;
