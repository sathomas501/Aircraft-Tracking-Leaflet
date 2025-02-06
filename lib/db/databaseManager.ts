import { Database, open } from 'sqlite';
import path from 'path';

let sqlite3: typeof import('sqlite3') | null = null;

// ✅ Ensures sqlite3 is only loaded on the server
if (typeof window === 'undefined') {
  try {
    sqlite3 = require('sqlite3');
    console.log('[DatabaseManager] Successfully loaded sqlite3');
  } catch (error) {
    console.error('[DatabaseManager] Failed to load sqlite3:', error);
  }
} else {
  console.warn('[DatabaseManager] sqlite3 is not available in the browser.');
}

const STATIC_DB_PATH = path.resolve(process.cwd(), 'lib', 'db', 'static.db');

export class DatabaseManager {
  private static instance: DatabaseManager;
  private db: Database | null = null;
  private isInitialized: boolean = false;
  private isInitializing: boolean = false;

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  private async initializeConnection(): Promise<Database> {
    if (typeof window !== 'undefined') {
      throw new Error('[DatabaseManager] Cannot use database in the browser.');
    }

    if (!sqlite3) {
      throw new Error(
        '[DatabaseManager] sqlite3 is only available in the server environment.'
      );
    }

    if (!this.db) {
      try {
        console.log('[DatabaseManager] Initializing database connection...');
        this.db = await open({
          filename: STATIC_DB_PATH,
          driver: sqlite3.Database,
        });
        console.log('[DatabaseManager] Database connection established.');
      } catch (error) {
        console.error(
          '[DatabaseManager] Error initializing database connection:',
          error
        );
        throw error;
      }
    }

    return this.db;
  }

  public async initializeDatabase(): Promise<void> {
    if (this.isInitialized) {
      console.log('[DatabaseManager] Database already initialized. Skipping.');
      return;
    }

    if (this.isInitializing) {
      console.log(
        '[DatabaseManager] Database initialization already in progress. Waiting...'
      );
      while (!this.isInitialized) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return;
    }

    this.isInitializing = true;

    try {
      await this.initializeConnection();
      if (!this.db) {
        throw new Error('[DatabaseManager] Database connection is null.');
      }

      console.log('[Database] Starting database initialization...');
      const tables = await this.db.all(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      console.log('[Database] Existing tables:', tables);

      const [{ count }] = await this.db.all(
        'SELECT COUNT(*) AS count FROM aircraft'
      );
      console.log(`[Database] Aircraft count: ${count}`);

      this.isInitialized = true;
      console.log('[DatabaseManager] Database successfully initialized.');
    } catch (error) {
      console.error('[DatabaseManager] Database initialization failed:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  public async executeQuery<T = any>(
    query: string,
    params: any[] = []
  ): Promise<T[]> {
    if (!this.isInitialized || !this.db) {
      console.warn(
        '[DatabaseManager] Database not fully initialized. Ensuring completion...'
      );
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error(
        '[DatabaseManager] Database connection is still null after initialization.'
      );
    }

    try {
      return this.db.all(query, params);
    } catch (error) {
      console.error(
        `[DatabaseManager] Query execution failed: ${query}`,
        error
      );
      throw error;
    }
  }

  public async allQuery<T extends object = any>(
    query: string,
    params: any[] = []
  ): Promise<T[]> {
    if (!this.isInitialized || !this.db) {
      console.warn(
        '[DatabaseManager] Database not fully initialized. Initializing...'
      );
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error(
        '[DatabaseManager] Database connection is still null after initialization.'
      );
    }

    try {
      console.log(`[DatabaseManager] Executing query: ${query}`, params);
      const results: T[] = await this.db.all(query, params);
      console.log(`[DatabaseManager] Query returned ${results.length} results`);
      return results;
    } catch (error) {
      console.error(
        `[DatabaseManager] Query execution failed: ${query}`,
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
        this.isInitialized = false;
        console.log(
          '[DatabaseManager] Database connection closed successfully'
        );
      } catch (error) {
        console.error('[DatabaseManager] Error closing database:', error);
        throw error;
      }
    }
  }
}

const databaseManager = DatabaseManager.getInstance();
export default databaseManager;
