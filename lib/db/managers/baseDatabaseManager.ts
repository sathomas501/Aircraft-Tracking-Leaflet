import path from 'path';
import type { Database as SQLiteDatabaseDriver } from 'sqlite';
import type sqlite3 from 'sqlite3'; // ✅ Explicitly import sqlite3 types

let fs: typeof import('fs') | null = null;
let sqlite3Instance: typeof sqlite3 | null = null;
let sqlite: typeof import('sqlite') | null = null;

// ✅ Ensure code runs only on the server
if (typeof window !== 'undefined') {
  throw new Error('baseDatabaseManager cannot be imported in the browser.');
}

// ✅ Load `fs` safely
try {
  fs = require('fs');
} catch (error) {
  console.error('[DatabaseManager] ❌ Failed to load fs module:', error);
}

// ✅ Load `sqlite3` & `sqlite` safely
try {
  sqlite3Instance = require('sqlite3').verbose();
  sqlite = require('sqlite');
  console.log('[DatabaseManager] ✅ Loaded sqlite and sqlite3 successfully');
} catch (error) {
  console.error('[DatabaseManager] ❌ Failed to load sqlite modules:', error);
  sqlite3Instance = null;
  sqlite = null;
}

export abstract class BaseDatabaseManager {
  // ✅ Use `sqlite3.Database` as a type alias
  protected db: SQLiteDatabaseDriver<sqlite3.Database> | null = null;
  protected _isInitialized: boolean = false;
  protected readonly dbPath: string;
  private initializationPromise: Promise<void> | null = null;

  constructor(dbName: string) {
    if (typeof window !== 'undefined') {
      throw new Error(
        'BaseDatabaseManager cannot be instantiated on the client side'
      );
    }

    const dbDir = path.resolve(process.cwd(), 'lib', 'db');

    // ✅ Ensure fs is available before using it
    if (fs) {
      try {
        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true });
        }
      } catch (error) {
        console.error(
          '[DatabaseManager] ❌ Failed to create database directory:',
          error
        );
        throw error;
      }
    }

    this.dbPath = path.join(dbDir, dbName);
  }

  public get isReady(): boolean {
    return this._isInitialized && this.db !== null;
  }

  protected async ensureInitialized(): Promise<
    SQLiteDatabaseDriver<sqlite3.Database>
  > {
    if (!this.isReady) {
      await this.initializeDatabase();
    }

    if (!this.db) {
      throw new Error('Database failed to initialize');
    }

    return this.db;
  }

  public async initializeDatabase(): Promise<void> {
    if (this.isReady) {
      return;
    }

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

  protected async performInitialization(): Promise<void> {
    try {
      if (typeof window !== 'undefined') {
        throw new Error('Cannot initialize database manager on client side');
      }

      if (!sqlite3Instance?.Database || !sqlite) {
        throw new Error('[DatabaseManager] ❌ sqlite3 is not available.');
      }

      this.db = await sqlite.open({
        filename: this.dbPath,
        driver: sqlite3Instance.Database, // ✅ Correctly reference the driver
      });

      await this.db.run('PRAGMA journal_mode = WAL;');
      await this.db.run('PRAGMA busy_timeout = 3000;');

      await this.createTables();
      this._isInitialized = true;
    } catch (error) {
      this._isInitialized = false;
      this.db = null;
      console.error(
        '[DatabaseManager] ❌ Database initialization failed:',
        error
      );
      throw error;
    }
  }

  protected abstract createTables(): Promise<void>;

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
