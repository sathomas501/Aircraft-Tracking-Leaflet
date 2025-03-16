import path from 'path';
import type { Database as SQLiteDatabaseDriver } from 'sqlite';
import type sqlite3 from 'sqlite3';

let fs: typeof import('fs') | null = null;
let sqlite3Instance: typeof import('sqlite3') | null = null;
let sqlite: typeof import('sqlite') | null = null;

// ✅ Load modules dynamically to prevent crashes
(async () => {
  try {
    fs = await import('fs');
  } catch (error) {
    console.error(
      '[BaseDatabaseManager] ❌ Failed to load `fs` module:',
      error
    );
  }

  try {
    sqlite3Instance = (await import('sqlite3')).verbose();
    sqlite = await import('sqlite');
    console.log(
      '[BaseDatabaseManager] ✅ Loaded sqlite and sqlite3 successfully'
    );
  } catch (error) {
    console.error('[BaseDatabaseManager] ❌ Failed to load SQLite:', error);
  }
})();

// ✅ Load SQLite modules safely
if (!sqlite3Instance || !sqlite) {
  try {
    sqlite3Instance = require('sqlite3').verbose();
    sqlite = require('sqlite');
    console.log(
      '[BaseDatabaseManager] ✅ Loaded sqlite and sqlite3 successfully'
    );
  } catch (error) {
    console.error('[BaseDatabaseManager] ❌ Failed to load SQLite:', error);
  }
}

// ✅ Export SQLite instances to prevent reloading
export { sqlite, sqlite3Instance };

export abstract class BaseDatabaseManager {
  protected db: SQLiteDatabaseDriver<sqlite3.Database> | null = null;
  protected _isInitialized: boolean = false;
  protected readonly dbPath: string;
  private initializationPromise: Promise<void> | null = null;
  protected static dbInstance: SQLiteDatabaseDriver<sqlite3.Database> | null =
    null;

  constructor(dbName: string) {
    if (typeof window !== 'undefined') {
      throw new Error(
        'BaseDatabaseManager cannot be instantiated on the client side.'
      );
    }

    // ✅ Get database directory once
    const dbDir = path.resolve(process.cwd(), 'lib', 'db');

    // ✅ Prevent duplicate directory in the path
    this.dbPath = path.isAbsolute(dbName) ? dbName : path.join(dbDir, dbName);

    // ✅ Log the resolved database path
    console.log(
      `[BaseDatabaseManager] 🔍 Database path resolved to: ${this.dbPath}`
    );

    // ✅ Ensure database directory exists before opening SQLite
    if (fs && !fs.existsSync(dbDir)) {
      console.warn(
        `[BaseDatabaseManager] 📁 Creating missing database directory: ${dbDir}`
      );
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // ✅ Ensure database file exists before opening (prevents `SQLITE_CANTOPEN`)
    if (fs && !fs.existsSync(this.dbPath)) {
      console.warn(
        `[BaseDatabaseManager] ⚠️ Database file not found, creating: ${this.dbPath}`
      );
      fs.writeFileSync(this.dbPath, ''); // Create an empty file
    }
  }

  /**
   * Check if database is fully initialized and ready
   */
  public get isReady(): boolean {
    return this._isInitialized && this.db !== null;
  }

  /**
   * Gets the default instance of the database manager.
   * This is implemented by concrete subclasses to provide a default instance.
   * @throws Error if called directly on BaseDatabaseManager
   * @returns A concrete instance of BaseDatabaseManager
   */
  public static getDefaultInstance(): BaseDatabaseManager {
    throw new Error('getDefaultInstance must be implemented by subclass');
  }
  /**
   * Ensure database is initialized before performing operations
   * Making this public so repositories can use it directly
   */
  public async ensureInitialized(): Promise<
    SQLiteDatabaseDriver<sqlite3.Database>
  > {
    if (!this.isReady) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('[BaseDatabaseManager] ❌ Database failed to initialize');
    }

    return this.db;
  }

  /**
   * Initialize the database
   */
  public async initializeDatabase(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    if (this._isInitialized && this.db) {
      return;
    }

    this.initializationPromise = (async () => {
      try {
        if (!sqlite || !sqlite3Instance) {
          throw new Error('[BaseDatabaseManager] ❌ SQLite modules not loaded');
        }

        console.log(
          `[BaseDatabaseManager] 🔄 Initializing database at: ${this.dbPath}`
        );

        this.db = await sqlite.open({
          filename: this.dbPath,
          driver: sqlite3Instance.Database,
        });

        // ✅ Ensure SQLite is ready
        await this.db.run('PRAGMA journal_mode = WAL;');
        await this.db.run('PRAGMA busy_timeout = 5000;');

        console.log(
          `[BaseDatabaseManager] ✅ Database initialized at: ${this.dbPath}`
        );
        this._isInitialized = true;
      } catch (error) {
        console.error(`[BaseDatabaseManager] ❌ Initialization failed:`, error);

        if ((error as any).code === 'SQLITE_CANTOPEN') {
          console.error(
            `[BaseDatabaseManager] 🚨 Unable to open database file: ${this.dbPath}. 
           Make sure the path is correct and accessible.`
          );
        }

        this._isInitialized = false;
        this.db = null;
        throw error;
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  /**
   * Perform the actual initialization work
   */
  protected async performInitialization(): Promise<void> {
    try {
      if (!sqlite3Instance?.Database || !sqlite) {
        throw new Error('[BaseDatabaseManager] ❌ SQLite is not available.');
      }

      console.log(
        `[BaseDatabaseManager] 🛠 Opening database at: ${this.dbPath}`
      );

      // ✅ Check if DB file exists before opening (prevents `SQLITE_CANTOPEN`)
      if (fs && !fs.existsSync(this.dbPath)) {
        console.warn(
          `[BaseDatabaseManager] ⚠️ Database file not found, creating: ${this.dbPath}`
        );
        fs.writeFileSync(this.dbPath, ''); // Create an empty file
      }

      this.db = await sqlite.open({
        filename: this.dbPath,
        driver: sqlite3Instance.Database,
      });

      await this.db.run('PRAGMA journal_mode = WAL;');
      await this.db.run('PRAGMA busy_timeout = 3000;');

      await this.createTables();
      this._isInitialized = true;
      console.log(
        `[BaseDatabaseManager] ✅ Database initialized successfully at: ${this.dbPath}`
      );
    } catch (error) {
      this._isInitialized = false;
      this.db = null;
      console.error(
        `[BaseDatabaseManager] ❌ Database initialization failed at: ${this.dbPath}`,
        error
      );
      throw error;
    }
  }

  /**
   * Abstract method to create tables, must be implemented by derived classes
   */
  protected abstract createTables(): Promise<void>;

  /**
   * Get database instance - public so repositories can access if needed
   */
  public async getDatabase(): Promise<SQLiteDatabaseDriver<sqlite3.Database>> {
    if (this.db) {
      return this.db; // Return the instance we already have
    }

    if (BaseDatabaseManager.dbInstance) {
      this.db = BaseDatabaseManager.dbInstance;
      return this.db;
    }

    // Initialize the database if needed
    await this.initializeDatabase();

    if (!this.db) {
      throw new Error('[BaseDatabaseManager] ❌ Failed to initialize database');
    }

    return this.db;
  }

  /**
   * Execute a SQL query with optional parameters
   */
  public async executeQuery<T>(
    sql: string,
    params: unknown[] = [],
    retries = 3
  ): Promise<T[]> {
    let currentRetry = 0;

    while (true) {
      try {
        const db = await this.getDatabase();
        return await db.all(sql, params);
      } catch (error: any) {
        // Check if it's a database lock error
        if (error.code === 'SQLITE_BUSY' && currentRetry < retries) {
          // Exponential backoff with random jitter
          const delay = Math.pow(2, currentRetry) * 100 + Math.random() * 100;
          console.warn(
            `[BaseDatabaseManager] ⚠️ Database locked, retrying in ${delay}ms (attempt ${currentRetry + 1}/${retries})`
          );

          await new Promise((resolve) => setTimeout(resolve, delay));
          currentRetry++;
        } else {
          console.error(`[BaseDatabaseManager] ❌ Query failed: ${sql}`, error);
          throw error;
        }
      }
    }
  }

  /**
   * Execute a database query with automatic retries for SQLITE_BUSY errors
   * @param sql SQL query to execute
   * @param params Query parameters
   * @param maxRetries Maximum number of retry attempts (default: a3)
   * @returns Query results
   */
  public async executeQueryWithRetry<T>(
    sql: string,
    params: any[] = [],
    maxRetries = 3
  ): Promise<T[]> {
    const db = await this.getDatabase();
    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount <= maxRetries) {
      try {
        // Execute the query
        return await db.all(sql, params);
      } catch (error: any) {
        lastError = error;

        // Check if it's a database lock error that we can retry
        if (error.code === 'SQLITE_BUSY' && retryCount < maxRetries) {
          // Exponential backoff with jitter
          const delay = Math.pow(2, retryCount) * 100 + Math.random() * 100;
          console.warn(
            `[DatabaseManager] ⚠️ Database is locked, retrying in ${delay.toFixed(0)}ms (attempt ${retryCount + 1}/${maxRetries})`
          );

          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, delay));
          retryCount++;
        } else {
          // Not a retryable error or max retries reached
          console.error(`[DatabaseManager] ❌ Query failed: ${sql}`, error);
          throw error;
        }
      }
    }

    // If we reach here, we've exhausted all retries
    console.error(
      `[DatabaseManager] ❌ Max retries (${maxRetries}) exceeded for query: ${sql}`
    );
    throw lastError || new Error('Database query failed after maximum retries');
  }

  /**
   * Close the database connection
   */
  public async close(): Promise<void> {
    if (this.db) {
      try {
        if (this._isInitialized) {
          await this.db.run('PRAGMA optimize');
        }
        await this.db.close();
        this.db = null;
        this._isInitialized = false;
      } catch (error) {
        console.error('[DatabaseManager] ❌ Error closing database:', error);
        throw error;
      }
    }
  }
}
