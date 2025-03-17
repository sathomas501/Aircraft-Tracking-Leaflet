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

    if (fs && !fs.existsSync(dbDir)) {
      console.warn(
        `[BaseDatabaseManager] 📁 Creating missing database directory: ${dbDir}`
      );
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Ensure database file exists before opening (prevents `SQLITE_CANTOPEN`)
    if (fs && !fs.existsSync(this.dbPath)) {
      console.warn(
        `[BaseDatabaseManager] ⚠️ Database file not found, creating: ${this.dbPath}`
      );
      fs.writeFileSync(this.dbPath, ''); // Create an empty file
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
    // If we're already initialized, return immediately
    if (this._isInitialized && this.db) {
      return;
    }

    // If we have an ongoing initialization, return that promise
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Check if there's a global initialization for this database path
    const existingInitialization =
      BaseDatabaseManager.initializingDatabases.get(this.dbPath);
    if (existingInitialization) {
      console.log(
        `[BaseDatabaseManager] ⏳ Waiting for existing initialization of ${this.dbPath}`
      );
      this.initializationPromise = existingInitialization;
      return existingInitialization;
    }

    // Create a new initialization promise
    this.initializationPromise = this.performInitialization();

    // Add to global tracking
    BaseDatabaseManager.initializingDatabases.set(
      this.dbPath,
      this.initializationPromise
    );

    try {
      await this.initializationPromise;
    } finally {
      // Remove from global tracking when done (success or failure)
      BaseDatabaseManager.initializingDatabases.delete(this.dbPath);
      this.initializationPromise = null;
    }

    return;
  }

  /**
   * Perform the actual initialization work
   */
  protected async performInitialization(): Promise<void> {
    try {
      // Ensure modules are loaded
      await loadModules();

      if (!sqlite3Instance || !sqlite) {
        throw new Error('[BaseDatabaseManager] ❌ SQLite modules not loaded');
      }

      console.log(
        `[BaseDatabaseManager] 🔄 Initializing database at: ${this.dbPath}`
      );

      // Ensure database file exists
      await this.ensureDatabaseDirectory(path.dirname(this.dbPath));

      this.db = await sqlite.open({
        filename: this.dbPath,
        driver: sqlite3Instance.Database,
      });

      // Ensure SQLite is ready
      await this.db.run('PRAGMA journal_mode = WAL;');
      await this.db.run('PRAGMA busy_timeout = 5000;');

      // Create the necessary tables
      await this.createTables();

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
  public async executeQuery<T extends object>(
    query: string,
    params: any[] = []
  ): Promise<T[]> {
    const db = await this.ensureInitialized();

    // Using await unwraps the Promise, giving us T[] directly
    return (await db.all(query, params)) as T[];
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
