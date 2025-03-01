import path from 'path';
import type { Database as SQLiteDatabaseDriver } from 'sqlite';
import type sqlite3 from 'sqlite3';

let fs: typeof import('fs') | null = null;
let sqlite3Instance: typeof sqlite3 | null = null;
let sqlite: typeof import('sqlite') | null = null;

// ✅ Load `fs` safely to prevent `fs`-related crashes
try {
  fs = require('fs');
} catch (error) {
  console.error('[BaseDatabaseManager] ❌ Failed to load `fs` module:', error);
}

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

  constructor(dbName: string) {
    if (typeof window !== 'undefined') {
      throw new Error(
        'BaseDatabaseManager cannot be instantiated on the client side.'
      );
    }

    const dbDir = path.resolve(process.cwd(), 'lib', 'db');

    // ✅ Ensure `fs` exists before checking paths
    if (fs) {
      try {
        if (!fs.existsSync(dbDir)) {
          console.log(
            `[BaseDatabaseManager] 📁 Creating database directory at: ${dbDir}`
          );
          fs.mkdirSync(dbDir, { recursive: true });
        }
      } catch (error) {
        console.error(
          `[BaseDatabaseManager] ❌ Failed to create database directory:`,
          error
        );
        throw error;
      }
    }

    // ✅ Ensure correct database path resolution
    if (path.isAbsolute(dbName)) {
      this.dbPath = dbName; // Use absolute path directly
    } else {
      this.dbPath = path.resolve(dbDir, dbName); // Resolve relative path correctly
    }
  }

  /**
   * Check if database is fully initialized and ready
   */
  public get isReady(): boolean {
    return this._isInitialized && this.db !== null;
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
    if (this.isReady) return;

    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    this.initializationPromise = this.performInitialization();
    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
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
    await this.ensureInitialized();
    if (!this.db) {
      throw new Error('[BaseDatabaseManager] Database not initialized');
    }
    return this.db;
  }

  /**
   * Execute a SQL query with optional parameters
   */
  public async executeQuery<T>(
    sql: string,
    params: unknown[] = []
  ): Promise<T[]> {
    const db = await this.ensureInitialized();

    try {
      return await db.all(sql, params);
    } catch (error) {
      console.error(`[DatabaseManager] ❌ Query failed: ${sql}`, error);
      throw error;
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
