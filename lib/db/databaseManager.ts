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
} else {
  console.warn('[DatabaseManager] ⚠️ sqlite3 is not available in the browser.');
}

const STATIC_DB_PATH = path.resolve(process.cwd(), 'lib', 'db', 'static.db');

export class DatabaseManager {
  private static instance: DatabaseManager;
  private db: Database | null = null;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  private async initializeConnection(): Promise<Database> {
    if (typeof window !== 'undefined') {
      throw new Error(
        '[DatabaseManager] ❌ Cannot use database in the browser.'
      );
    }

    if (!sqlite3) {
      throw new Error(
        '[DatabaseManager] ❌ sqlite3 is only available in the server environment.'
      );
    }

    if (!this.db) {
      try {
        console.log('[DatabaseManager] 🔄 Initializing database connection...');
        this.db = await open({
          filename: STATIC_DB_PATH,
          driver: sqlite3.Database,
        });
        console.log('[DatabaseManager] ✅ Database connection established.');
      } catch (error) {
        console.error(
          '[DatabaseManager] ❌ Error initializing database:',
          error
        );
        throw error;
      }
    }

    return this.db;
  }

  public async initializeDatabase(): Promise<void> {
    if (this.isInitialized) {
      console.log('[DatabaseManager] ✅ Database already initialized.');
      return;
    }

    if (!this.initializationPromise) {
      this.initializationPromise = this.performInitialization();
    }

    return this.initializationPromise;
  }

  private async performInitialization(): Promise<void> {
    try {
      await this.initializeConnection();
      if (!this.db) {
        throw new Error('[DatabaseManager] ❌ Database connection is null.');
      }

      console.log('[DatabaseManager] 🔍 Checking existing tables...');
      const tables = await this.db.all(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      console.log(
        '[DatabaseManager] ✅ Existing tables:',
        tables.map((t) => t.name)
      );

      const [{ count }] = await this.db.all(
        'SELECT COUNT(*) AS count FROM aircraft'
      );
      console.log(`[DatabaseManager] ✈️ Aircraft Count: ${count}`);

      this.isInitialized = true;
      console.log('[DatabaseManager] ✅ Database successfully initialized.');
    } catch (error) {
      console.error(
        '[DatabaseManager] ❌ Database initialization failed:',
        error
      );
      throw error;
    } finally {
      this.initializationPromise = null; // Reset promise to allow reinitialization if needed
    }
  }

  public async executeQuery<T = any>(
    query: string,
    params: any[] = []
  ): Promise<T[]> {
    if (!this.isInitialized) {
      console.error(
        '[DatabaseManager] ❌ Attempted to query an uninitialized database.'
      );
      throw new Error(
        '[DatabaseManager] ❌ Database is not initialized. Cannot execute queries.'
      );
    }

    if (!this.db) {
      throw new Error('[DatabaseManager] ❌ Database connection is null.');
    }

    try {
      console.time(`[DatabaseManager] ⏳ Query Execution Time: ${query}`);
      const result = await this.db.all(query, params);
      console.timeEnd(`[DatabaseManager] ⏳ Query Execution Time: ${query}`);
      return result;
    } catch (error) {
      console.error(
        `[DatabaseManager] ❌ Query execution failed: ${query} | Params: ${JSON.stringify(params)}`,
        error
      );
      throw error;
    }
  }

  public async allQuery<T extends object = any>(
    query: string,
    params: any[] = []
  ): Promise<T[]> {
    return this.executeQuery<T>(query, params);
  }

  public async close(): Promise<void> {
    if (this.db) {
      try {
        console.log('[DatabaseManager] 🔄 Running PRAGMA optimize...');
        await this.db.run('PRAGMA optimize');
        await this.db.close();
        this.db = null;
        this.isInitialized = false;
        console.log(
          '[DatabaseManager] ✅ Database connection closed successfully.'
        );
      } catch (error) {
        console.error('[DatabaseManager] ❌ Error closing database:', error);
        throw error;
      }
    }
  }
}

const databaseManager = DatabaseManager.getInstance();
export default databaseManager;
