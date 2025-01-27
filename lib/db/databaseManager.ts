
import { open, Database } from 'sqlite';
import path from 'path';
import { STATIC_SCHEMA } from './schema';
import { ManufacturerData } from '@/types/base';

// Conditional sqlite3 import
let sqlite3: typeof import('sqlite3') | null = null;
if (typeof window === 'undefined') {
    sqlite3 = require('sqlite3');
    console.log('[Database] Successfully loaded sqlite3');
} else {
    console.warn('[Database] sqlite3 is not available in the browser.');
}

const STATIC_DB_PATH = path.join(process.cwd(), 'lib', 'db', 'static.db');
console.log('[Database] Database path:', STATIC_DB_PATH);

export class DatabaseManager {
    private static instance: DatabaseManager;
    private db: Database | null = null;
    private isInitialized: boolean = false;

    private constructor() {}

    public static getInstance(): DatabaseManager {
        if (!DatabaseManager.instance) {
            DatabaseManager.instance = new DatabaseManager();
        }
        return DatabaseManager.instance;
    }

    private async initializeConnection(): Promise<Database> {
        if (!sqlite3) {
            throw new Error('[DatabaseManager] sqlite3 is only available in the server environment.');
        }
        if (!this.db) {
            this.db = await open({
                filename: STATIC_DB_PATH,
                driver: sqlite3.Database
            });
        }
        return this.db;
    }

    private async initializeDatabase(): Promise<void> {
        if (!this.db) return;

        try {
            console.log('[Database] Starting database initialization...');

            await this.db.exec(`
                PRAGMA journal_mode = WAL;
                PRAGMA busy_timeout = 30000;
                PRAGMA synchronous = NORMAL;
                PRAGMA temp_store = MEMORY;
                PRAGMA mmap_size = 30000000000;
                PRAGMA page_size = 4096;
                PRAGMA cache_size = -2000;
            `);

            await this.db.exec(STATIC_SCHEMA);

            const tables = await this.db.all("SELECT name FROM sqlite_master WHERE type='table'");
            console.log('[Database] Existing tables:', tables);

            const count = await this.db.get('SELECT COUNT(*) as count FROM aircraft');
            console.log('[Database] Aircraft count:', count?.count || 0);
        } catch (error) {
            console.error('[Database] Error initializing schema:', error);
            throw error;
        }
    }

    // Public method to initialize the database
    public async initialize(): Promise<void> {
        if (this.isInitialized) {
            console.log('[DatabaseManager] Database is already initialized.');
            return;
        }

        await this.initializeConnection();
        await this.initializeDatabase();

        this.isInitialized = true;
        console.log('[DatabaseManager] Database successfully initialized.');
    }


    public async ensureInitialized(): Promise<void> {
        if (typeof window !== 'undefined') {
            console.log('[DatabaseManager] Skipping initialization in browser');
            return;
        }
    
        if (!this.isInitialized) {
            console.log('[DatabaseManager] Starting database initialization...');
            await this.initializeConnection();
            await this.initializeDatabase();
            this.isInitialized = true;
            console.log('[DatabaseManager] Database successfully initialized');
        }
    }


    public async getDb(): Promise<Database> {
        return this.initializeConnection();
    }

    public async runQuery<T>(query: string, params: any[] = []): Promise<T> {
        const db = await this.getDb();
        return db.run(query, params) as Promise<T>;
    }

    public async getQuery<T>(query: string, params: any[] = []): Promise<T> {
        const db = await this.getDb();
        return db.get(query, params) as Promise<T>;
    }

    public async allQuery<T>(query: string, params: any[] = []): Promise<T[]> {
        const db = await this.getDb();
        return db.all(query, params) as Promise<T[]>;
    }

    public async getManufacturerByName(name: string): Promise<ManufacturerData | null> {
        const db = await this.getDb();
        const result = await db.get(
            `SELECT 
                manufacturer as name,
                COUNT(*) as count
             FROM aircraft
             WHERE 
                manufacturer = ?
             GROUP BY manufacturer
             LIMIT 1;`,
            [name]
        );
    
        return result || null;
    }
    
    
    public async vacuum(): Promise<void> {
        const db = await this.getDb();
        await db.exec('VACUUM;');
        console.log('[Database] Vacuum completed successfully');
    }

    public async optimize(): Promise<void> {
        const db = await this.getDb();
        await db.exec(`
            ANALYZE;
            PRAGMA optimize;
        `);
        console.log('[Database] Optimization completed successfully');
    }

    public async getTableStats(): Promise<any> {
        const db = await this.getDb();
        const stats = await db.all(`
            SELECT 
                name as table_name,
                (SELECT COUNT(*) FROM aircraft) as row_count,
                ROUND((SELECT SUM(pgsize) FROM dbstat WHERE name = 'aircraft') / 1024.0 / 1024.0, 2) as size_mb
            FROM sqlite_master 
            WHERE type='table' AND name='aircraft';
        `);
        return stats;
    }

    public async closeConnection(): Promise<void> {
        if (this.db) {
            await this.db.close();
            this.db = null;
            this.isInitialized = false;
        }
    }
}

export class StaticDatabaseManager {
    private static instance: StaticDatabaseManager | null = null;

    private constructor() {}

    // Define the singleton instance method
    public static getInstance(): StaticDatabaseManager {
        if (!StaticDatabaseManager.instance) {
            StaticDatabaseManager.instance = new StaticDatabaseManager();
        }
        return StaticDatabaseManager.instance;
    }

    // Example: Return a database connection
    public async getDb(): Promise<any> {
        // Your logic for returning the static database connection
    }
}

// Create and export the singleton instance
const databaseManagerInstance = DatabaseManager.getInstance();
export default databaseManagerInstance;

// Named exports for specific methods
export const getDatabase = () => databaseManagerInstance.getDb();
export const runQuery = <T>(query: string, params: any[] = []) =>
    databaseManagerInstance.runQuery<T>(query, params);
export const getQuery = <T>(query: string, params: any[] = []) =>
    databaseManagerInstance.getQuery<T>(query, params);
export const allQuery = <T>(query: string, params: any[] = []) =>
    databaseManagerInstance.allQuery<T>(query, params);
