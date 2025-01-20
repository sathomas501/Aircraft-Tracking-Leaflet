// lib/db/databaseManager.ts

import { open, Database } from 'sqlite';
import path from 'path';
import { AircraftStatus } from '@/types/database';


let sqlite3: typeof import('sqlite3');
if (typeof window === 'undefined') {
    sqlite3 = require('sqlite3');
}

export async function getDatabase(): Promise<Database> {
    return await open({
        filename: './path/to/database.db',
        driver: sqlite3!.Database,
    });
}

export const STATIC_SCHEMA = `
    CREATE TABLE IF NOT EXISTS aircraft (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        icao24 TEXT UNIQUE,
        "N-NUMBER" TEXT,
        manufacturer TEXT,
        model TEXT,
        operator TEXT,
        NAME TEXT,
        CITY TEXT,
        STATE TEXT,
        aircraft_type TEXT,
        owner_type TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Optimize indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_aircraft_icao24 ON aircraft(icao24);
    CREATE INDEX IF NOT EXISTS idx_aircraft_manufacturer ON aircraft(manufacturer);
    CREATE INDEX IF NOT EXISTS idx_aircraft_model ON aircraft(model);
    CREATE INDEX IF NOT EXISTS idx_aircraft_type ON aircraft(aircraft_type, owner_type);
    CREATE INDEX IF NOT EXISTS idx_aircraft_operator ON aircraft(operator);
`;

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
        if (!this.db) {
            const dbPath = path.join(process.cwd(), 'lib', 'db', 'aircraft.db');
            this.db = await open({
                filename: dbPath,
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

        try {
            // Configure SQLite for better performance
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

            // Create triggers for updated_at
            await this.db.exec(`
                CREATE TRIGGER IF NOT EXISTS update_aircraft_timestamp 
                AFTER UPDATE ON aircraft
                BEGIN
                    UPDATE aircraft 
                    SET updated_at = CURRENT_TIMESTAMP 
                    WHERE id = NEW.id;
                END;
            `);

            // Analyze tables for query optimization
            await this.db.exec('ANALYZE;');

            this.isInitialized = true;
            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Error initializing database:', error);
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
        console.log('Database vacuumed successfully');
    }

    public async optimize(): Promise<void> {
        const db = await this.getDb();
        await db.exec(`
            ANALYZE;
            PRAGMA optimize;
        `);
        console.log('Database optimized successfully');
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
export const getActiveDb = () => databaseManagerInstance.getDb();
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