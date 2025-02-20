// lib/db/managers/trackingDatabaseManager.ts
import { BaseDatabaseManager } from '../managers/baseDatabaseManager';
import type { Aircraft } from '@/types/base';
import path from 'path';

let fs: typeof import('fs') | null = null;

if (typeof window === 'undefined') {
  fs = require('fs');
}

interface SQLiteResult {
  changes: number;
  lastID: number;
}

class TrackingDatabaseManager extends BaseDatabaseManager {
  private static instance: TrackingDatabaseManager | null = null;

  private constructor(dbPath?: string) {
    if (typeof window !== 'undefined') {
      throw new Error(
        'TrackingDatabaseManager cannot be used on the client side'
      );
    }

    // ✅ Use __dirname for better compatibility
    const defaultDbPath = process.env.DB_DIR
      ? path.join(process.env.DB_DIR, 'tracking.db')
      : path.resolve(__dirname, '..', 'db', 'tracking.db');

    const resolvedDbPath = dbPath || defaultDbPath;

    // ✅ Ensure the database directory exists before opening SQLite
    const dbDir = path.dirname(resolvedDbPath);
    if (fs && !fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    super(resolvedDbPath);
  }

  public static getInstance(dbPath?: string): TrackingDatabaseManager {
    if (typeof window !== 'undefined') {
      throw new Error(
        'TrackingDatabaseManager cannot be used on the client side'
      );
    }

    if (!TrackingDatabaseManager.instance) {
      TrackingDatabaseManager.instance = new TrackingDatabaseManager(dbPath);
    }

    return TrackingDatabaseManager.instance;
  }

  public async executeQuery<T>(
    sql: string,
    params: unknown[] = []
  ): Promise<T[]> {
    const db = await this.ensureInitialized();
    if (!db) {
      throw new Error('Database not initialized');
    }
    try {
      return await db.all(sql, params);
    } catch (error) {
      console.error(`[DatabaseManager] Query failed: ${sql}`, error);
      throw error;
    }
  }

  // Add this method to your TrackingDatabaseManager class

  public async getDatabaseState(): Promise<{
    isReady: boolean;
    tables: string[];
    cacheStatus: {
      manufacturersAge: number | null;
      icaosAge: number | null;
    };
  }> {
    try {
      const tables = !this.db
        ? []
        : await this.executeQuery<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type='table'"
          ).then((results) => results.map((r) => r.name));

      return {
        isReady: this.isReady,
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

  protected async createTables(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Enable foreign keys and WAL mode
    await this.db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 3000;
  `);

    // Create the `tracked_aircraft` table
    await this.db.exec(`
    CREATE TABLE IF NOT EXISTS tracked_aircraft (
      icao24 TEXT PRIMARY KEY,
      latitude REAL,
      longitude REAL,
      altitude REAL,
      velocity REAL,
      heading REAL,
      on_ground INTEGER,
      last_contact INTEGER,
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
  `);

    // Create the `active_tracking` table with constraints
    await this.db.exec(`
    CREATE TABLE IF NOT EXISTS active_tracking (
      icao24 TEXT PRIMARY KEY,
      manufacturer TEXT,
      model TEXT,
      marker TEXT,
      latitude REAL NOT NULL DEFAULT 0,
      longitude REAL NOT NULL DEFAULT 0,
      altitude REAL DEFAULT 0,
      velocity REAL DEFAULT 0,
      heading REAL DEFAULT 0,
      on_ground INTEGER DEFAULT 0,
      last_contact INTEGER,
      last_seen INTEGER,
      TYPE_AIRCRAFT TEXT,
      "N-NUMBER" TEXT,
      OWNER_TYPE TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      CONSTRAINT valid_coordinates CHECK (
        latitude BETWEEN -90 AND 90 AND
        longitude BETWEEN -180 AND 180
      ),
      CONSTRAINT valid_heading CHECK (
        heading BETWEEN 0 AND 360 OR heading IS NULL
      )
    );

    -- Create indices for better query performance
    CREATE INDEX IF NOT EXISTS idx_active_tracking_manufacturer
      ON active_tracking(manufacturer);
    CREATE INDEX IF NOT EXISTS idx_active_tracking_last_seen
      ON active_tracking(last_seen);
    CREATE INDEX IF NOT EXISTS idx_active_tracking_coords
      ON active_tracking(latitude, longitude);
  `);

    console.log('[TrackingDB] ✅ Tables and indices created successfully');
  }

  /**
   * Fetch tracked aircraft by ICAO24 codes (batch mode)
   */
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
    const manufacturerFilter = manufacturer ? 'AND manufacturer = ?' : '';

    const query = `
      SELECT * FROM active_tracking 
      WHERE icao24 IN (${placeholders}) 
      ${manufacturerFilter}
    `;

    return this.executeQuery<Aircraft>(query, params);
  }

  /**
   * Upsert multiple aircraft tracking data efficiently
   */
  public async upsertLiveAircraft(aircraftData: Aircraft[]): Promise<void> {
    await this.ensureInitialized();

    if (!aircraftData.length) return;

    const sql = `
      INSERT OR REPLACE INTO active_tracking (
        icao24, manufacturer, model, marker, latitude, longitude,
        altitude, velocity, heading, on_ground, last_contact,
        last_seen, TYPE_AIRCRAFT, "N-NUMBER", OWNER_TYPE,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      await this.executeQuery('BEGIN TRANSACTION');

      for (const aircraft of aircraftData) {
        await this.executeQuery(sql, [
          aircraft.icao24,
          aircraft.manufacturer || null,
          aircraft.model || null,
          aircraft['N-NUMBER'] || null,
          aircraft.latitude,
          aircraft.longitude,
          aircraft.altitude || 0,
          aircraft.velocity || 0,
          aircraft.heading || 0,
          aircraft.on_ground ? 1 : 0,
          aircraft.last_contact || Math.floor(Date.now() / 1000),
          Math.floor(Date.now() / 1000),
          aircraft.TYPE_AIRCRAFT || null,
          aircraft['N-NUMBER'] || null,
          aircraft.OWNER_TYPE || null,
          Math.floor(Date.now() / 1000),
          Math.floor(Date.now() / 1000),
        ]);
      }

      await this.executeQuery('COMMIT');
    } catch (error) {
      await this.executeQuery('ROLLBACK');
      throw error;
    }
  }

  public async getTrackedICAOs(): Promise<string[]> {
    const db = await this.ensureInitialized(); // ✅ Ensure a valid DB connection

    try {
      const rows: { icao24: string }[] = await db.all(
        `SELECT icao24 FROM tracked_icao24s`
      );
      return rows.map((row) => row.icao24); // ✅ Type-safe mapping
    } catch (error) {
      console.error(`[Database] ❌ Error fetching tracked ICAOs:`, error);
      throw new Error('Failed to fetch tracked ICAOs');
    }
  }

  /**
   * Fetch recently tracked aircraft within a specific timeframe
   */
  public async getRecentTrackedAircraft(
    staleThresholdHours: number = 2
  ): Promise<Aircraft[]> {
    await this.ensureInitialized();

    const staleThreshold =
      Math.floor(Date.now() / 1000) - staleThresholdHours * 60 * 60;
    return this.executeQuery<Aircraft>(
      `SELECT * FROM tracked_aircraft 
       WHERE last_contact > ? 
       ORDER BY last_contact DESC`,
      [staleThreshold]
    );
  }

  /**
   * Upsert multiple active aircraft in batch mode
   */
  public async upsertActiveAircraftBatch(
    aircraftData: Aircraft[]
  ): Promise<number> {
    await this.ensureInitialized();

    try {
      await this.executeQuery('BEGIN TRANSACTION');

      for (const aircraft of aircraftData) {
        await this.executeQuery(
          `INSERT INTO active_tracking (
            icao24, manufacturer, model, marker, latitude, longitude,
            altitude, velocity, heading, on_ground, last_contact,
            last_seen, TYPE_AIRCRAFT, "N-NUMBER", OWNER_TYPE, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(icao24) DO UPDATE SET
            manufacturer = COALESCE(excluded.manufacturer, active_tracking.manufacturer),
            model = COALESCE(NULLIF(excluded.model, ''), active_tracking.model),
            latitude = excluded.latitude,
            longitude = excluded.longitude,
            altitude = excluded.altitude,
            velocity = excluded.velocity,
            heading = excluded.heading,
            on_ground = excluded.on_ground,
            last_contact = excluded.last_contact,
            last_seen = excluded.last_seen,
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
            aircraft.last_contact || Math.floor(Date.now() / 1000),
            Date.now(),
            aircraft.TYPE_AIRCRAFT || '',
            aircraft['N-NUMBER'] || '',
            aircraft.OWNER_TYPE || '',
            Date.now(),
          ]
        );
      }

      await this.executeQuery('COMMIT');
      return aircraftData.length;
    } catch (error) {
      await this.executeQuery('ROLLBACK');
      throw new Error(
        error instanceof Error
          ? `Failed to upsert aircraft batch: ${error.message}`
          : 'Failed to upsert aircraft batch'
      );
    }
  }

  // Add this method to your TrackingDatabaseManager class

  public async updatePosition(
    icao24: string,
    latitude: number,
    longitude: number,
    heading: number
  ): Promise<void> {
    await this.ensureInitialized();

    try {
      const sql = `
      UPDATE tracked_aircraft 
      SET latitude = ?, 
          longitude = ?, 
          heading = ?,
          updated_at = strftime('%s', 'now')
      WHERE icao24 = ?
    `;

      await this.executeQuery(sql, [latitude, longitude, heading, icao24]);
    } catch (error) {
      console.error('[TrackingDB] Failed to update position:', error);
      throw new Error(
        error instanceof Error
          ? `Failed to update position: ${error.message}`
          : 'Failed to update position'
      );
    }
  }

  // Add this to TrackingDatabaseManager class

  public async performMaintenance(): Promise<{ cleanedRecords: number }> {
    if (typeof window !== 'undefined') {
      throw new Error(
        'Database maintenance cannot be performed on the client side'
      );
    }
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
      throw new Error(
        error instanceof Error
          ? `Maintenance failed: ${error.message}`
          : 'Maintenance failed'
      );
    }
  }
}

// Create a single instance
const trackingDatabaseManager = TrackingDatabaseManager.getInstance();

// Export both the class and the instance
export { TrackingDatabaseManager };
export default trackingDatabaseManager;
export function getAircraftByIcao24(
  batch: string[]
): Aircraft[] | PromiseLike<Aircraft[]> {
  throw new Error('Function not implemented.');
}
