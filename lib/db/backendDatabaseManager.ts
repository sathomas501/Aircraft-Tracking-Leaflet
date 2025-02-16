import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';
import path from 'path';
import {
  errorHandler,
  ErrorType,
} from '@/lib/services/error-handler/error-handler';

class BackendDatabaseManager {
  private static instance: BackendDatabaseManager | null = null;
  private db: Database | null = null;
  private readonly TRACKING_DB_PATH = path.join(
    process.cwd(),
    'lib',
    'db',
    'tracking.db'
  );
  private isInitialized = false;
  private initializingPromise: Promise<void> | null = null; // ✅ Prevents multiple inits

  private constructor() {
    if (typeof window !== 'undefined') {
      throw new Error('Cannot initialize database manager on client side');
    }
  }

  public static getInstance(): BackendDatabaseManager {
    if (!BackendDatabaseManager.instance) {
      BackendDatabaseManager.instance = new BackendDatabaseManager();
    }
    return BackendDatabaseManager.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[BackendDatabaseManager] ✅ Database already initialized.');
      return;
    }

    // ✅ Prevent multiple inits by setting a lock
    if (this.initializingPromise) {
      console.log(
        '[BackendDatabaseManager] 🔄 Waiting for existing initialization...'
      );
      await this.initializingPromise;
      return;
    }

    this.initializingPromise = (async () => {
      try {
        console.log(
          '[BackendDatabaseManager] 🔄 Initializing tracking database...'
        );

        this.db = await this.connectToDatabase();

        if (!this.db) {
          throw new Error(
            '[BackendDatabaseManager] ❌ Database connection failed.'
          );
        }

        // Enable WAL mode for better concurrency
        await this.executeQuery('PRAGMA journal_mode=WAL');
        await this.executeQuery('PRAGMA foreign_keys=ON');

        // Create tables if they don't exist
        await this.ensureTablesExist();

        console.log(
          '[BackendDatabaseManager] ✅ Tracking database initialized successfully.'
        );

        // ✅ Set `isInitialized = true` ONLY after full success
        this.isInitialized = true;
      } catch (error: unknown) {
        const err = error as Error;
        console.error(
          '[BackendDatabaseManager] ❌ Initialization failed:',
          err.message
        );

        // ✅ Reset only on fatal DB corruption issues
        if (
          err.message.includes('database disk image is malformed') ||
          err.message.includes('unable to open database file')
        ) {
          this.isInitialized = false;
          this.db = null;
        }

        throw err;
      } finally {
        this.initializingPromise = null; // ✅ Cleanup initialization lock
      }
    })();

    return this.initializingPromise;
  }

  private async connectToDatabase(): Promise<Database> {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.TRACKING_DB_PATH, (err) => {
        if (err) {
          console.error('[BackendDatabaseManager] ❌ Connection failed:', err);
          reject(err);
        } else {
          console.log(
            `[BackendDatabaseManager] ✅ Connected to tracking database at ${this.TRACKING_DB_PATH}`
          );
          resolve(db);
        }
      });
    });
  }

  private async ensureTablesExist(): Promise<void> {
    console.log(
      '[BackendDatabaseManager] 🔍 Checking and creating tracking tables...'
    );

    const tables = await this.executeQuery<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table';"
    );
    console.log(
      '[BackendDatabaseManager] 📋 Existing tables:',
      tables.map((t) => t.name)
    );

    // Create tracked_aircraft table if it doesn't exist
    if (!tables.some((t) => t.name === 'tracked_aircraft')) {
      console.log(
        '[BackendDatabaseManager] 🛠️ Creating tracked_aircraft table...'
      );
      await this.executeQuery(`
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
        CREATE INDEX IF NOT EXISTS idx_tracked_aircraft_last_contact 
          ON tracked_aircraft(last_contact);
      `);
    }

    // Create active_tracking table if it doesn't exist
    if (!tables.some((t) => t.name === 'active_tracking')) {
      console.log(
        '[BackendDatabaseManager] 🛠️ Creating active_tracking table...'
      );
      await this.executeQuery(`
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
        CREATE INDEX IF NOT EXISTS idx_active_tracking_manufacturer 
          ON active_tracking(manufacturer);
        CREATE INDEX IF NOT EXISTS idx_active_tracking_last_seen 
          ON active_tracking(last_seen);
        CREATE INDEX IF NOT EXISTS idx_active_tracking_coords 
          ON active_tracking(latitude, longitude);
      `);
    }

    console.log(
      '[BackendDatabaseManager] ✅ Tracking tables verified and created if needed'
    );
  }

  async executeQuery<T = any>(sql: string, params: any[] = []): Promise<T> {
    if (!this.isInitialized) {
      console.log(
        '[BackendDatabaseManager] ⚠️ Database not initialized, skipping query:',
        sql
      );
      throw new Error('Database is not initialized');
    }

    return new Promise((resolve, reject) => {
      console.time(`[BackendDatabaseManager] ⏳ Query: ${sql.split('\n')[0]}`);
      this.db!.all(sql, params, (err, rows) => {
        console.timeEnd(
          `[BackendDatabaseManager] ⏳ Query: ${sql.split('\n')[0]}`
        );

        if (err) {
          console.error('[BackendDatabaseManager] ❌ Query error:', err);

          // ✅ Only reset `isInitialized` if the DB is truly corrupted
          if (
            err.message.includes('database disk image is malformed') ||
            err.message.includes('unable to open database file')
          ) {
            this.isInitialized = false;
            this.db = null;
          }

          return reject(err);
        }

        resolve(rows as T);
      });
    });
  }

  async close(shutdown: boolean = false): Promise<void> {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db!.close((err) => {
          if (err) {
            console.error(
              '[BackendDatabaseManager] ❌ Error closing database:',
              err
            );
            reject(err);
          } else {
            console.log('[BackendDatabaseManager] ✅ Database closed');
            this.db = null;

            // ✅ Only reset `isInitialized` if shutting down
            if (shutdown) {
              this.isInitialized = false;
            }

            resolve();
          }
        });
      });
    }
  }
}

export default BackendDatabaseManager;
