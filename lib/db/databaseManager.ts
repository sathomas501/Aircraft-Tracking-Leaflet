import { Database, open } from 'sqlite';
import path from 'path';

let sqlite3: typeof import('sqlite3') | null = null;

<<<<<<< Updated upstream
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
=======
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
>>>>>>> Stashed changes
}

const STATIC_DB_PATH = path.resolve(process.cwd(), 'lib', 'db', 'static.db');

export class DatabaseManager {
  private static instance: DatabaseManager;
  private db: Database | null = null;
  private isInitialized: boolean = false;
<<<<<<< Updated upstream
  private isInitializing: boolean = false;
=======
  private initializationPromise: Promise<void> | null = null;
>>>>>>> Stashed changes

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  private async initializeConnection(): Promise<Database> {
    if (typeof window !== 'undefined') {
<<<<<<< Updated upstream
      throw new Error('[DatabaseManager] Cannot use database in the browser.');
=======
      throw new Error(
        '[DatabaseManager] ❌ Cannot use database in the browser.'
      );
>>>>>>> Stashed changes
    }

    if (!sqlite3) {
      throw new Error(
<<<<<<< Updated upstream
        '[DatabaseManager] sqlite3 is only available in the server environment.'
=======
        '[DatabaseManager] ❌ sqlite3 is only available in the server environment.'
>>>>>>> Stashed changes
      );
    }

    if (!this.db) {
      try {
<<<<<<< Updated upstream
        console.log('[DatabaseManager] Initializing database connection...');
=======
        console.log('[DatabaseManager] 🔄 Initializing database connection...');
>>>>>>> Stashed changes
        this.db = await open({
          filename: STATIC_DB_PATH,
          driver: sqlite3.Database,
        });
<<<<<<< Updated upstream
        console.log('[DatabaseManager] Database connection established.');
      } catch (error) {
        console.error(
          '[DatabaseManager] Error initializing database connection:',
=======
        console.log('[DatabaseManager] ✅ Database connection established.');
      } catch (error) {
        console.error(
          '[DatabaseManager] ❌ Error initializing database:',
>>>>>>> Stashed changes
          error
        );
        throw error;
      }
    }

    return this.db;
  }

  public async initializeDatabase(): Promise<void> {
    if (this.isInitialized) {
<<<<<<< Updated upstream
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
=======
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
>>>>>>> Stashed changes

      const [{ count }] = await this.db.all(
        'SELECT COUNT(*) AS count FROM aircraft'
      );
<<<<<<< Updated upstream
      console.log(`[Database] Aircraft count: ${count}`);

      this.isInitialized = true;
      console.log('[DatabaseManager] Database successfully initialized.');
    } catch (error) {
      console.error('[DatabaseManager] Database initialization failed:', error);
      throw error;
    } finally {
      this.isInitializing = false;
=======
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
>>>>>>> Stashed changes
    }
  }

  public async executeQuery<T = any>(
    query: string,
    params: any[] = []
  ): Promise<T[]> {
<<<<<<< Updated upstream
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
=======
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
>>>>>>> Stashed changes
        error
      );
      throw error;
    }
  }

  public async allQuery<T extends object = any>(
    query: string,
    params: any[] = []
  ): Promise<T[]> {
<<<<<<< Updated upstream
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
=======
    return this.executeQuery<T>(query, params);
>>>>>>> Stashed changes
  }

  public async close(): Promise<void> {
    if (this.db) {
      try {
<<<<<<< Updated upstream
=======
        console.log('[DatabaseManager] 🔄 Running PRAGMA optimize...');
>>>>>>> Stashed changes
        await this.db.run('PRAGMA optimize');
        await this.db.close();
        this.db = null;
        this.isInitialized = false;
        console.log(
<<<<<<< Updated upstream
          '[DatabaseManager] Database connection closed successfully'
        );
      } catch (error) {
        console.error('[DatabaseManager] Error closing database:', error);
=======
          '[DatabaseManager] ✅ Database connection closed successfully.'
        );
      } catch (error) {
        console.error('[DatabaseManager] ❌ Error closing database:', error);
>>>>>>> Stashed changes
        throw error;
      }
    }
  }
}

const databaseManager = DatabaseManager.getInstance();
export default databaseManager;
