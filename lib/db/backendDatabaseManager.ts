import { Database, open } from 'sqlite';
import path from 'path';

let sqlite3: typeof import('sqlite3') | null = null;

if (typeof window === 'undefined') {
  try {
    sqlite3 = require('sqlite3').verbose();
    console.log('[BackendDatabaseManager] ✅ Loaded sqlite3 successfully');
  } catch (error) {
    console.error('[BackendDatabaseManager] ❌ Failed to load sqlite3:', error);
    throw error;
  }
}

class BackendDatabaseManager {
  private static instance: BackendDatabaseManager | null = null;
  private db: Database | null = null;
  private readonly TRACKING_DB_PATH = path.join(
    process.cwd(),
    'lib',
    'db',
    'tracking.db'
  );
  private _isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private initLock = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      throw new Error('Cannot initialize database manager on client side');
    }
  }

  public get isReady(): boolean {
    return this._isInitialized;
  }

  public static getInstance(): BackendDatabaseManager {
    if (!BackendDatabaseManager.instance) {
      BackendDatabaseManager.instance = new BackendDatabaseManager();
    }
    return BackendDatabaseManager.instance;
  }

  private async waitForInitialization(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
  }

  public async getDatabaseState(): Promise<{
    isReady: boolean;
    tables: string[];
  }> {
    await this.waitForInitialization();

    try {
      if (!this.isReady) {
        return { isReady: false, tables: [] };
      }

      const query = "SELECT name FROM sqlite_master WHERE type='table'";
      const tables = await this.executeQuery<{ name: string }>(query);

      return {
        isReady: true,
        tables: tables.map((t) => t.name),
      };
    } catch (error) {
      console.error(
        '[DatabaseManager] ❌ Error getting database state:',
        error
      );
      return {
        isReady: false,
        tables: [],
      };
    }
  }

  public async initializeDatabase(): Promise<void> {
    if (this._isInitialized) {
      console.log('[BackendDatabaseManager] ✅ Database already initialized.');
      return;
    }

    if (this.initializationPromise) {
      console.log(
        '[BackendDatabaseManager] 🔄 Waiting for existing initialization...'
      );
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();

    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
  }

  private async performInitialization(): Promise<void> {
    if (this.initLock) {
      console.log(
        '[BackendDatabaseManager] 🔒 Waiting for existing initialization...'
      );
      await new Promise((resolve) => setTimeout(resolve, 500));
      return;
    }

    this.initLock = true;
    let retries = 3;

    try {
      // Verify directory exists
      const dbDir = path.dirname(this.TRACKING_DB_PATH);
      if (!require('fs').existsSync(dbDir)) {
        console.log(
          `[BackendDatabaseManager] 📁 Creating database directory: ${dbDir}`
        );
        require('fs').mkdirSync(dbDir, { recursive: true });
      }

      // Check directory permissions
      try {
        require('fs').accessSync(dbDir, require('fs').constants.W_OK);
        console.log('[BackendDatabaseManager] ✅ Directory is writable');
      } catch (err) {
        console.error(
          '[BackendDatabaseManager] ❌ Directory is not writable:',
          err
        );
        throw err;
      }

      while (retries > 0) {
        try {
          if (!sqlite3) {
            throw new Error(
              '[BackendDatabaseManager] ❌ sqlite3 not available'
            );
          }

          if (retries < 3) {
            console.log(
              `[BackendDatabaseManager] 🔄 Retrying initialization (attempts remaining: ${retries})`
            );
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }

          this.db = await open({
            filename: this.TRACKING_DB_PATH,
            driver: sqlite3.Database,
          });

          await this.db.get('SELECT 1');
          console.log(
            '[BackendDatabaseManager] ✅ Database connection established.'
          );

          const tables = await this.db.all<{ name: string }[]>(
            "SELECT name FROM sqlite_master WHERE type='table'"
          );
          console.log(
            '[BackendDatabaseManager] 📊 Existing tables:',
            tables.map((t) => t.name)
          );

          await this.ensureTablesExist(tables);

          this._isInitialized = true;
          console.log(
            '[BackendDatabaseManager] ✅ Tracking database successfully initialized.'
          );
          return;
        } catch (error) {
          retries--;
          if (retries === 0) {
            throw error;
          }
          console.error(
            `[BackendDatabaseManager] ⚠️ Initialization attempt failed, retrying...`,
            error
          );
        }
      }
    } catch (error: unknown) {
      const err = error as Error;
      this._isInitialized = false;
      this.db = null;
      console.error(
        '[BackendDatabaseManager] ❌ All initialization attempts failed:',
        err.message
      );
      throw err;
    } finally {
      this.initLock = false;
    }
  }

  private async ensureTablesExist(tables: { name: string }[]): Promise<void> {
    console.log(
      '[BackendDatabaseManager] 🔍 Checking and creating tracking tables...'
    );

    const createTableQueries = [
      `CREATE TABLE IF NOT EXISTS tracked_aircraft (
        icao24 TEXT PRIMARY KEY,
        latitude REAL,
        longitude REAL,
        altitude REAL,
        velocity REAL,
        heading REAL,
        on_ground INTEGER,
        last_contact INTEGER,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )`,
      `CREATE TABLE IF NOT EXISTS active_tracking (
        icao24 TEXT PRIMARY KEY,
        manufacturer TEXT NOT NULL,
        model TEXT,
        marker TEXT,
        latitude REAL,
        longitude REAL,
        altitude REAL,
        velocity REAL,
        heading REAL,
        on_ground BOOLEAN,
        last_contact TIMESTAMP,
        last_seen TIMESTAMP,
        TYPE_AIRCRAFT TEXT DEFAULT 'default',
        N_NUMBER TEXT,
        OWNER_TYPE TEXT,
        updated_at INTEGER,
        created_at INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS aircraft_history (
        icao24 TEXT PRIMARY KEY,
        latitude REAL,
        longitude REAL,
        altitude REAL,
        velocity REAL,
        heading REAL,
        last_contact INTEGER,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )`,
    ];

    for (const query of createTableQueries) {
      await this.executeQuery(query);
    }
  }

  async executeQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this._isInitialized) {
      console.warn(
        '[BackendDatabaseManager] ⚠️ Database not initialized. Attempting to initialize...'
      );
      try {
        await this.initializeDatabase();
      } catch (err) {
        console.error(
          '[BackendDatabaseManager] ❌ Failed to initialize database:',
          err
        );
        throw new Error('Database is not initialized');
      }
    }

    return new Promise<T[]>((resolve, reject) => {
      this.db!.all(sql, params, (err: Error | null, rows: T[]) => {
        if (err) {
          console.error('[BackendDatabaseManager] ❌ Query error:', err);
          return reject(err);
        }
        resolve(rows);
      });
    });
  }

  public async close(): Promise<void> {
    if (this.db) {
      try {
        await this.db.run('PRAGMA optimize');
        await this.db.close();
        this.db = null;
        console.log('[BackendDatabaseManager] ✅ Database connection closed');
      } catch (error) {
        console.error(
          '[BackendDatabaseManager] ❌ Error closing database:',
          error
        );
      }
    }
  }
}

export default BackendDatabaseManager;
