import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { AircraftStatus } from '@/types/database';


class DatabaseManager {
    private static db: Database | null = null;

    public static async getDb(): Promise<Database> {
        if (!DatabaseManager.db) {
            const dbPath = path.join(process.cwd(), 'lib','db', 'aircraft.db');
            DatabaseManager.db = await open({
                filename: dbPath,
                driver: sqlite3.Database,
            });
        }
        return DatabaseManager.db;
    }

    // Clear active status for all or specific aircraft
    public static async clearActiveStatus(icao24?: string): Promise<void> {
        const db = await this.getDb();
        try {
            if (icao24) {
                // Clear status for a specific aircraft
                const query = `
                    UPDATE aircraft
                    SET is_active = 0, updated_at = CURRENT_TIMESTAMP
                    WHERE icao24 = ?
                `;
                await db.run(query, [icao24]);
                console.log(`Cleared active status for aircraft: ${icao24}`);
            } else {
                // Clear status for all aircraft
                const query = `
                    UPDATE aircraft
                    SET is_active = 0, updated_at = CURRENT_TIMESTAMP
                `;
                await db.run(query);
                console.log('Cleared active status for all aircraft');
            }
        } catch (error) {
            console.error('Error clearing active status:', error);
            throw error;
        }
    }

    
    public static async updateAircraftStatus(icao24: string, status: AircraftStatus): Promise<void> {
        const db = await this.getDb();
        const query = `
            UPDATE aircraft
            SET
                latitude = ?,
                longitude = ?,
                altitude = ?,
                velocity = ?,
                heading = ?,
                on_ground = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE icao24 = ?
        `;
        await db.run(query, [
            status.latitude,
            status.longitude,
            status.altitude,
            status.velocity,
            status.heading,
            status.on_ground ? 1 : 0,
            icao24,
        ]);
    }
    

    // Initialize required schemas
    private static async initializeSchemas(): Promise<void> {
        if (!DatabaseManager.db) return;

        // Create static aircraft table
        await DatabaseManager.db.exec(`
            CREATE TABLE IF NOT EXISTS aircraft (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                "N-NUMBER" TEXT,
                icao24 TEXT UNIQUE,
                manufacturer TEXT,
                model TEXT,
                operator TEXT,
                NAME TEXT,
                CITY TEXT,
                STATE TEXT,
                TYPE_AIRCRAFT TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_contact INTEGER,
                is_active INTEGER DEFAULT 0,
                latitude REAL,
                longitude REAL,
                altitude REAL,
                velocity REAL,
                heading REAL,
                on_ground INTEGER DEFAULT 0,
                updated_at TIMESTAMP
            );
        `);

        // Create dynamic active aircraft table
        await DatabaseManager.db.exec(`
            CREATE TABLE IF NOT EXISTS active_aircraft (
                icao24 TEXT PRIMARY KEY,
                manufacturer TEXT NOT NULL,
                model TEXT,
                last_contact INTEGER NOT NULL,
                latitude REAL,
                longitude REAL,
                altitude REAL,
                velocity REAL,
                heading REAL,
                on_ground BOOLEAN DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(icao24)
            );
        `);

        // Add indexes for performance
        await DatabaseManager.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_aircraft_icao24 ON aircraft(icao24);
            CREATE INDEX IF NOT EXISTS idx_aircraft_manufacturer ON aircraft(manufacturer);
            CREATE INDEX IF NOT EXISTS idx_active_manufacturer ON active_aircraft(manufacturer);
            CREATE INDEX IF NOT EXISTS idx_active_last_contact ON active_aircraft(last_contact);
        `);

        console.log('Database schemas initialized successfully');
    }

    // Close the database connection
    public static async closeDb(): Promise<void> {
        if (DatabaseManager.db) {
            await DatabaseManager.db.close();
            DatabaseManager.db = null;
        }
    }

    // Execute a query (e.g., INSERT, UPDATE)
    public static async runQuery(query: string, params: any[] = []): Promise<any> {
        const db = await this.getDb();
        return db.run(query, params);
    }

    // Fetch a single row
    public static async getQuery(query: string, params: any[] = []): Promise<any> {
        const db = await this.getDb();
        return db.get(query, params);
    }

    // Fetch multiple rows
    public static async allQuery(query: string, params: any[] = []): Promise<any[]> {
        const db = await this.getDb();
        return db.all(query, params);
    }


}


export default DatabaseManager;
export const getActiveDb = DatabaseManager.getDb;
export const runQuery = DatabaseManager.runQuery;
export const getQuery = DatabaseManager.getQuery;
