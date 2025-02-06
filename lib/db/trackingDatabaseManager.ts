import { Database, open } from 'sqlite';
import path from 'path';

let sqlite3: typeof import('sqlite3') | null = null;

// ✅ Ensures sqlite3 is only loaded on the server
if (typeof window === 'undefined') {
  try {
    sqlite3 = require('sqlite3');
    console.log('[TrackingDatabaseManager] Successfully loaded sqlite3');
  } catch (error) {
    console.error('[TrackingDatabaseManager] Failed to load sqlite3:', error);
  }
} else {
  console.warn(
    '[TrackingDatabaseManager] sqlite3 is not available in the browser.'
  );
}

const TRACKING_DB_PATH = path.resolve(
  process.cwd(),
  'lib',
  'db',
  'tracking.db'
);

export class TrackingDatabaseManager {
  private static instance: TrackingDatabaseManager;
  private db: Database | null = null;
  private isInitialized: boolean = false;

  private constructor() {}

  public static getInstance(): TrackingDatabaseManager {
    if (!TrackingDatabaseManager.instance) {
      TrackingDatabaseManager.instance = new TrackingDatabaseManager();
    }
    return TrackingDatabaseManager.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized && this.db) {
      return;
    }

    try {
      if (!sqlite3) {
        throw new Error('[TrackingDatabaseManager] sqlite3 is not loaded.');
      }

      this.db = await open({
        filename: TRACKING_DB_PATH,
        driver: sqlite3.Database,
      });

      await this.createTables();
      this.isInitialized = true;
      console.log(
        '[TrackingDatabaseManager] Database initialized with schema.'
      );
    } catch (error) {
      console.error('[TrackingDatabaseManager] Initialization failed:', error);
      this.db = null;
      this.isInitialized = false;
      throw error;
    }
  }

  public getDb(): Database | null {
    return this.db;
  }

  public async getAll<T>(query: string, params: any[]): Promise<T[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return this.db.all<T[]>(query, params);
  }

  private async createTables(): Promise<void> {
    if (!this.db)
      throw new Error('[TrackingDatabaseManager] Database not initialized.');

    try {
      await this.db.exec(`
                CREATE TABLE IF NOT EXISTS tracked_aircraft (
                    icao24 TEXT PRIMARY KEY,
                    latitude REAL,
                    longitude REAL,
                    altitude REAL,
                    velocity REAL,
                    heading REAL,
                    last_contact INTEGER,
                    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
                );
            `);

      console.log('[TrackingDatabaseManager] Tables created successfully');
    } catch (error) {
      console.error(
        '[TrackingDatabaseManager] Failed to create tables:',
        error
      );
      throw error;
    }
  }

  public async upsertActiveAircraftBatch(aircraftData: any[]): Promise<void> {
    await this.ensureInitialized();

    const query = `INSERT INTO tracked_aircraft (icao24, updated_at) VALUES (?, ?) 
                   ON CONFLICT(icao24) DO UPDATE SET updated_at = excluded.updated_at`;

    const db = this.getDb();
    if (!db) {
      throw new Error('Database not initialized');
    }
    const stmt = await db.prepare(query);

    for (const aircraft of aircraftData) {
      await stmt.run([aircraft.icao24, Date.now()]);
    }

    await stmt.finalize();
    console.log(
      `[TrackingDatabaseManager] Upserted ${aircraftData.length} records into tracked_aircraft.`
    );
  }

  public async executeQuery<T = any>(
    query: string,
    params: any[] = []
  ): Promise<T[]> {
    if (!this.db) {
      throw new Error('[TrackingDatabaseManager] Database is not initialized.');
    }
    return this.db.all(query, params);
  }

  public async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.isInitialized = false;
      console.log('[TrackingDatabaseManager] Database connection closed.');
    }
  }

  public async trackAircraft(icao24: string): Promise<void> {
    await this.ensureInitialized();
    const query = `INSERT INTO tracked_aircraft (icao24, updated_at) VALUES (?, ?) 
                       ON CONFLICT(icao24) DO UPDATE SET updated_at = excluded.updated_at`;

    await this.db!.run(query, [icao24, Date.now()]);
  }

  public async updateAircraftPosition(
    icao24: string,
    lat: number,
    lon: number,
    heading: number
  ): Promise<void> {
    await this.ensureInitialized();
    const query = `UPDATE tracked_aircraft SET latitude = ?, longitude = ?, heading = ?, updated_at = ? WHERE icao24 = ?`;
    await this.db!.run(query, [lat, lon, heading, Date.now(), icao24]);
  }

  public async clearTrackingData(): Promise<void> {
    await this.ensureInitialized();
    await this.db!.run(`DELETE FROM tracked_aircraft`);
  }

  public async getTrackedAircraft(): Promise<any[]> {
    await this.ensureInitialized();
    return this.db!.all(`SELECT * FROM tracked_aircraft`);
  }

  public async getStaleAircraft(): Promise<{ icao24: string }[]> {
    await this.ensureInitialized();
    const staleThreshold = Date.now() - 5 * 60 * 1000;
    return this.db!.all(
      `SELECT icao24 FROM tracked_aircraft WHERE last_contact < ?`,
      [staleThreshold]
    );
  }

  public async cleanStaleRecords(): Promise<void> {
    await this.ensureInitialized();
    const staleThreshold = Date.now() - 5 * 60 * 1000;
    await this.db!.run(`DELETE FROM tracked_aircraft WHERE last_contact < ?`, [
      staleThreshold,
    ]);
    console.log(
      `[TrackingDatabaseManager] Cleaned stale records older than ${staleThreshold} ms.`
    );
  }

  public async deleteAircraft(icao24: string): Promise<void> {
    await this.ensureInitialized();

    const query = `DELETE FROM tracked_aircraft WHERE icao24 = ?`;
    await this.db!.run(query, [icao24]);

    console.log(
      `[TrackingDatabaseManager] Deleted aircraft with ICAO24: ${icao24}`
    );
  }

  public async stop(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.isInitialized = false;
      console.log('[TrackingDatabaseManager] Connection closed.');
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized || !this.db) {
      console.warn(
        '[TrackingDatabaseManager] Database not fully initialized. Initializing now...'
      );
      await this.initialize();
    }
  }
}

const trackingDatabaseManager = TrackingDatabaseManager.getInstance();
export default trackingDatabaseManager;
