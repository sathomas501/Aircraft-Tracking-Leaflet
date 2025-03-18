import path from 'path';
import type { Database as SQLiteDatabaseDriver } from 'sqlite';
import type sqlite3 from 'sqlite3';

// Track loaded modules globally to avoid reloading
let fs: typeof import('fs') | null = null;
let sqlite3Instance: typeof import('sqlite3') | null = null;
let sqlite: typeof import('sqlite') | null = null;
let isLoadingModules = false;
let modulesLoadedPromise: Promise<void> | null = null;

// Load modules once and share across all instances
async function loadModules(): Promise<void> {
  if (modulesLoadedPromise) {
    return modulesLoadedPromise;
  }

  if (isLoadingModules) {
    // Wait for existing loading to complete
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (!isLoadingModules) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);
    });
    return;
  }

  isLoadingModules = true;

  modulesLoadedPromise = (async () => {
    try {
      // Load fs module if not already loaded
      if (!fs) {
        try {
          fs = await import('fs');
          console.log('[BaseDatabaseManager] ✅ Loaded fs module');
        } catch (error) {
          console.error(
            '[BaseDatabaseManager] ❌ Failed to load fs module:',
            error
          );
        }
      }

      // Load SQLite modules if not already loaded
      if (!sqlite3Instance || !sqlite) {
        try {
          sqlite3Instance = (await import('sqlite3')).verbose();
          sqlite = await import('sqlite');
          console.log(
            '[BaseDatabaseManager] ✅ Loaded sqlite and sqlite3 successfully'
          );
        } catch (error) {
          console.error(
            '[BaseDatabaseManager] ❌ Failed to load SQLite modules:',
            error
          );

          // Fallback to require (for older Node.js environments)
          try {
            sqlite3Instance = require('sqlite3').verbose();
            sqlite = require('sqlite');
            console.log(
              '[BaseDatabaseManager] ✅ Loaded sqlite and sqlite3 via require'
            );
          } catch (requireError) {
            console.error(
              '[BaseDatabaseManager] ❌ Failed to load SQLite via require:',
              requireError
            );
          }
        }
      }
    } finally {
      isLoadingModules = false;
    }
  })();

  return modulesLoadedPromise;
}

// Load modules immediately
loadModules();

// Export SQLite instances to prevent reloading
export { sqlite, sqlite3Instance };

export abstract class BaseDatabaseManager {
  protected db: SQLiteDatabaseDriver<sqlite3.Database> | null = null;
  protected _isInitialized: boolean = false;
  protected readonly dbPath: string;
  private initializationPromise: Promise<void> | null = null;
  private initializationAttempted: boolean = false;

  protected static dbInstance: SQLiteDatabaseDriver<sqlite3.Database> | null =
    null;

  // Map to track initialization status by database path
  private static initializingDatabases: Map<string, Promise<void>> = new Map();

  constructor(dbName: string) {
    if (typeof window !== 'undefined') {
      throw new Error(
        'BaseDatabaseManager cannot be instantiated on the client side.'
      );
    }

    // Get database directory once, without duplication
    const dbDir = path.resolve(process.cwd(), 'lib', 'db');

    this.dbPath =
      dbName.includes('lib/db') || dbName.includes('lib\\db')
        ? path.resolve(process.cwd(), dbName)
        : path.join(dbDir, dbName);

    console.log(
      `[BaseDatabaseManager] 🔍 Database path resolved to: ${this.dbPath}`
    );

    // Ensure database directory exists (non-blocking)
    this.ensureDatabaseDirectory(dbDir);
  }

  /**
   * Check if database is fully initialized and ready
   */
  public get isReady(): boolean {
    return this._isInitialized && this.db !== null;
  }

  /**
   * Ensures database directory exists
   */
  private async ensureDatabaseDirectory(dbDir: string): Promise<void> {
    await loadModules(); // Ensure modules are loaded

    if (typeof window !== 'undefined') {
      console.warn(
        '[BaseDatabaseManager] ❌ File system access not allowed in browser.'
      );
      return; // Skip execution in browser environments
    }

    try {
      // ✅ Check if the directory exists
      if (fs && !fs.existsSync(dbDir)) {
        console.warn(
          `[BaseDatabaseManager] 📁 Creating missing database directory: ${dbDir}`
        );
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // ✅ Check if the database file exists
      if (fs && !fs.existsSync(this.dbPath)) {
        console.warn(
          `[BaseDatabaseManager] ⚠️ Database file not found: ${this.dbPath}`
        );
        console.error(
          '[BaseDatabaseManager] ❌ SQLite database must be pre-created.'
        );
        throw new Error(
          'Database file is missing. It must be manually created.'
        );
      }
    } catch (error) {
      console.error('[BaseDatabaseManager] ❌ FS Error:', error);
      throw new Error(
        'Database initialization failed due to file system restrictions.'
      );
    }
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
   * Initialize the database with built-in deduplication
   */
  public async initializeDatabase(): Promise<void> {
    if (this._isInitialized && this.db) {
      return;
    }

    if (this.initializationPromise) {
      console.log(
        `[BaseDatabaseManager] ⏳ Waiting for initialization to complete...`
      );
      return this.initializationPromise;
    }

    let existingInitialization = BaseDatabaseManager.initializingDatabases.get(
      this.dbPath
    );
    if (existingInitialization) {
      console.log(
        `[BaseDatabaseManager] ⏳ Using existing initialization of ${this.dbPath}`
      );
      return existingInitialization;
    }

    console.log(
      `[BaseDatabaseManager] 🔄 Starting database initialization: ${this.dbPath}`
    );

    this.initializationPromise = this.performInitialization();
    BaseDatabaseManager.initializingDatabases.set(
      this.dbPath,
      this.initializationPromise
    );

    try {
      await this.initializationPromise;
      this._isInitialized = true;
      console.log(
        `[BaseDatabaseManager] ✅ Database successfully initialized.`
      );
    } catch (error) {
      console.error(
        '[BaseDatabaseManager] ❌ Database initialization failed:',
        error
      );
      this._isInitialized = false;
      this.db = null;
      throw error;
    } finally {
      BaseDatabaseManager.initializingDatabases.delete(this.dbPath);
      this.initializationPromise = null;
    }
  }

  /**
   * Perform the actual initialization work
   */
  protected async performInitialization(): Promise<void> {
    try {
      await loadModules();

      if (!sqlite3Instance || !sqlite) {
        throw new Error('[BaseDatabaseManager] ❌ SQLite modules not loaded');
      }

      console.log(
        `[BaseDatabaseManager] 🔄 Initializing database at: ${this.dbPath}`
      );

      await this.ensureDatabaseDirectory(path.dirname(this.dbPath));

      this.db = await sqlite.open({
        filename: this.dbPath,
        driver: sqlite3Instance.Database,
      });

      // ✅ Enable WAL mode and timeout
      await this.db.run('PRAGMA journal_mode = WAL;');
      await this.db.run('PRAGMA busy_timeout = 30000;');
      console.log(
        '[BaseDatabaseManager] ✅ WAL mode enabled and busy timeout set to 30s'
      );

      // ✅ Wrap table creation in a transaction
      await this.db.run('BEGIN TRANSACTION;');
      await this.createTables();
      await this.db.run('COMMIT;');

      console.log(
        `[BaseDatabaseManager] ✅ Database initialized at: ${this.dbPath}`
      );
      this._isInitialized = true;
    } catch (error) {
      console.error(`[BaseDatabaseManager] ❌ Initialization failed:`, error);

      if ((error as any).code === 'SQLITE_CANTOPEN') {
        console.error(
          `[BaseDatabaseManager] 🚨 Unable to open database file: ${this.dbPath}. Make sure the path is correct and accessible.`
        );
      }

      this._isInitialized = false;
      this.db = null;
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
   * @param query The SQL query to execute
   * @param params Optional parameters for the query
   * @returns Array of results of type T
   */
  async executeQuery<T>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.db) {
      throw new Error(
        '[BaseDatabaseManager] ❌ Database connection is not initialized'
      );
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error(
          `[BaseDatabaseManager] ❌ Query timeout exceeded: ${sql}`
        );
        reject(new Error('Query timeout exceeded'));
      }, 5000); // ✅ Increase timeout to 5s

      interface QueryResultRow {
        [key: string]: any;
      }

      interface QueryError extends Error {
        code?: string;
      }

      this.db!.all<QueryResultRow[]>(
        sql,
        params,
        (err: QueryError | null, rows: QueryResultRow[]) => {
          clearTimeout(timeout);
          if (err) {
            console.error(
              `[BaseDatabaseManager] ❌ Query error: ${err.message}`
            );
            return reject(err);
          }
          resolve(rows as T[]);
        }
      );
    });
  }

  /**
   * Execute a database query with automatic retries for SQLITE_BUSY errors
   * @param sql SQL query to execute
   * @param params Query parameters
   * @param maxRetries Maximum number of retry attempts (default: 3)
   * @returns Query results
   */
  public async executeQueryWithRetry<T extends object>(
    sql: string,
    params: any[] = [],
    maxRetries = 3
  ): Promise<T[]> {
    const db = await this.getDatabase();
    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount <= maxRetries) {
      try {
        // Execute the query - await unwraps the promise, so we return T[] directly
        return (await db.all(sql, params)) as T[];
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
   * Get a single row from the database
   * @param query The SQL query to execute
   * @param params Optional parameters for the query
   * @returns A single result of type T or undefined if not found
   */
  public async get<T extends object>(
    query: string,
    params: any[] = []
  ): Promise<T | undefined> {
    const db = await this.ensureInitialized();
    // await unwraps the Promise, giving us T | undefined directly
    return (await db.get(query, params)) as T | undefined;
  }

  public async getRowCount(tableName: string): Promise<number> {
    if (!this.db) {
      throw new Error('[BaseDatabaseManager] ❌ Database not initialized');
    }

    try {
      // ✅ Use SQLite's metadata instead of COUNT(*)
      const result = await this.executeQuery<{ count: number }>(
        `SELECT (SELECT seq FROM sqlite_sequence WHERE name = ?) AS count`,
        [tableName]
      );

      return result[0]?.count || 0; // ✅ Returns estimated row count
    } catch (error) {
      console.error(
        `[BaseDatabaseManager] ❌ Failed to get row count for ${tableName}:`,
        error
      );
      return 0; // ✅ Prevents failure if the query fails
    }
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
