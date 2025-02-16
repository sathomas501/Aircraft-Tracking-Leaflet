// lib/db/databaseManager.ts
import { Database, open } from 'sqlite';
import path from 'path';

let sqlite3: typeof import('sqlite3') | null = null;

if (typeof window === 'undefined') {
  try {
    sqlite3 = require('sqlite3').verbose();
    console.log('[DatabaseManager] ✅ Loaded sqlite3 successfully');
  } catch (error) {
    console.error('[DatabaseManager] ❌ Failed to load sqlite3:', error);
    throw error;
  }
}

const STATIC_DB_PATH = path.resolve(process.cwd(), 'lib', 'db', 'static.db');

export class DatabaseManager {
  private static instance: DatabaseManager;
  private db: Database | null = null;
  private _isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public get isReady(): boolean {
    return this._isInitialized && this.db !== null;
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
      console.log('[DatabaseManager] ✅ Database already initialized.');
      return;
    }

    if (this.initializationPromise) {
      console.log(
        '[DatabaseManager] 🔄 Waiting for existing initialization...'
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
    try {
      if (typeof window !== 'undefined') {
        throw new Error(
          '[DatabaseManager] ❌ Cannot initialize on client side'
        );
      }

      if (!sqlite3) {
        throw new Error('[DatabaseManager] ❌ sqlite3 not available');
      }

      console.log('[DatabaseManager] 🔄 Initializing database connection...');

      this.db = await open({
        filename: STATIC_DB_PATH,
        driver: sqlite3.Database,
      });

      // Test connection
      await this.db.get('SELECT 1');

      console.log('[DatabaseManager] ✅ Database connection established.');

      // Check tables
      const tables = await this.db.all(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      console.log(
        '[DatabaseManager] 📊 Existing tables:',
        tables.map((t) => t.name)
      );

      // Verify aircraft table
      const [{ count }] = await this.db.all(
        'SELECT COUNT(*) AS count FROM aircraft'
      );
      console.log(`[DatabaseManager] ✈️ Aircraft Count: ${count}`);

      this._isInitialized = true;
      console.log('[DatabaseManager] ✅ Database successfully initialized.');
    } catch (error) {
      this._isInitialized = false;
      this.db = null;
      console.error('[DatabaseManager] ❌ Initialization failed:', error);
      throw error;
    }
  }

  public async executeQuery<T = any>(
    query: string,
    params: any[] = []
  ): Promise<T[]> {
    await this.waitForInitialization();

    if (!this.isReady) {
      console.error('[DatabaseManager] ❌ Database not initialized');
      throw new Error('[DatabaseManager] Database is not initialized');
    }

    try {
      console.time(`[DatabaseManager] ⏳ Query: ${query.split('\n')[0]}`);
      const result = await this.db!.all(query, params);
      console.timeEnd(`[DatabaseManager] ⏳ Query: ${query.split('\n')[0]}`);
      return result;
    } catch (error) {
      console.error(
        `[DatabaseManager] ❌ Query failed: ${query.split('\n')[0]}`,
        error
      );
      throw error;
    }
  }

  public async close(): Promise<void> {
    if (this.db) {
      try {
        await this.db.run('PRAGMA optimize');
        await this.db.close();
        this.db = null;
        this._isInitialized = false;
        console.log('[DatabaseManager] ✅ Database connection closed');
      } catch (error) {
        console.error('[DatabaseManager] ❌ Error closing database:', error);
        throw error;
      }
    }
  }
}

const databaseManager = DatabaseManager.getInstance();
export default databaseManager;
