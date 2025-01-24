// lib/db/databaseManager.ts

import { open, Database } from 'sqlite';
import path from 'path'; // Node.js path module
import { STATIC_SCHEMA } from './schema'; // Import the schema
import { access, constants } from 'fs/promises';


export const config = {
    runtime: 'nodejs', // Ensure Node.js runtime
};

let sqlite3: typeof import('sqlite3') | null = null;

// Load SQLite3 only in server environments
if (typeof window === 'undefined') {
    try {
        sqlite3 = require('sqlite3');
        console.log('[Database] Successfully loaded sqlite3');
    } catch (err: any) {
        console.error('[Database] Failed to load sqlite3:', err);
        throw new Error(`Failed to initialize sqlite3: ${err?.message || 'Unknown error'}`);
    }
}

if (!sqlite3) {
    console.warn('[Database] sqlite3 is not initialized. Ensure this code runs in the Node.js environment.');
}

const STATIC_DB_PATH = path.join(process.cwd(), 'lib', 'db', 'static.db');


console.log('[Database] Database path:', STATIC_DB_PATH);


class DatabaseManager {
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
        try {
            await access(STATIC_DB_PATH, constants.R_OK | constants.W_OK);
            console.log('[Database] File is readable/writable');
        } catch {
            console.error('[Database] Permission denied');
        }
        
        if (!this.db) {
            if (!sqlite3) {
                throw new Error('[Database] sqlite3 is not initialized.');
            }

            this.db = await open({
                filename: STATIC_DB_PATH,
                driver: sqlite3.Database,
            });

            if (!this.isInitialized) {
                await this.initializeDatabase();
            }
        }
        return this.db;
    }

    private async initializeDatabase(): Promise<void> {
        if (!this.db) return;
     

// Add to initializeDatabase():
const testData = await this.db.get('SELECT * FROM aircraft LIMIT 1');
console.log('[Database] Sample record:', testData);

        try {
            // Add logging to check if this runs
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
     
            // Initialize schema 
            await this.db.exec(STATIC_SCHEMA);
            
            // Verify tables exist
            const tables = await this.db.all("SELECT name FROM sqlite_master WHERE type='table'");
            console.log('[Database] Existing tables:', tables);
            
            // Check record count
            const count = await this.db.get('SELECT COUNT(*) as count FROM aircraft');
            console.log('[Database] Aircraft count:', count);
     
        } catch (error) {
            console.error('[Database] Error initializing schema:', error);
            throw error;
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

// Create the singleton instance
const databaseManagerInstance = DatabaseManager.getInstance();

// Export the instance methods
export const getDatabase = () => databaseManagerInstance.getDb();
export const runQuery = <T>(query: string, params: any[] = []) =>
    databaseManagerInstance.runQuery<T>(query, params);
export const getQuery = <T>(query: string, params: any[] = []) =>
    databaseManagerInstance.getQuery<T>(query, params);
export const allQuery = <T>(query: string, params: any[] = []) =>
    databaseManagerInstance.allQuery<T>(query, params);
export const optimizeDb = () => databaseManagerInstance.optimize();
export const vacuumDb = () => databaseManagerInstance.vacuum();
export const getDbStats = () => databaseManagerInstance.getTableStats();

export type { Database };
