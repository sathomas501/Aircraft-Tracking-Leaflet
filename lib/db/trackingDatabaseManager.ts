import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import { Aircraft } from '@/types/base';

const TRACKING_DB_PATH = path.join(process.cwd(), 'lib', 'db', 'tracking.db');

export class TrackingDatabaseManager {
    private static instance: TrackingDatabaseManager;
    private db: Database | null = null;
    private isInitialized: boolean = false;

    private constructor() {}

    public static getInstance(): TrackingDatabaseManager {
        if (!TrackingDatabaseManager.instance) {
            TrackingDatabaseManager.instance = new TrackingDatabaseManager();
        }
        return TrackingDatabaseManager.instance;
    }

    public async initialize(): Promise<void> {
        if (this.isInitialized && this.db) {
            return;
        }

        try {
            this.db = await open({
                filename: TRACKING_DB_PATH,
                driver: sqlite3.Database,
            });
            
            await this.createTables();
            this.isInitialized = true;
            console.log('[TrackingDatabaseManager] Database initialized with schema.');
        } catch (error) {
            console.error('[TrackingDatabaseManager] Initialization failed:', error);
            this.db = null;
            this.isInitialized = false;
            throw error;
        }
    }

    private async createTables(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized.');
    
        try {
            // Drop and recreate tables for clean initialization
            await this.db.exec(`
                DROP TABLE IF EXISTS aircraft;
    
                CREATE TABLE IF NOT EXISTS aircraft (
                    icao24 TEXT PRIMARY KEY,
                    manufacturer TEXT,  -- ✅ Added manufacturer column
                    latitude REAL,
                    longitude REAL,
                    altitude REAL,
                    velocity REAL,
                    heading REAL,
                    on_ground INTEGER,  -- SQLite uses INTEGER for boolean
                    last_contact INTEGER,
                    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
                );
    
                CREATE INDEX IF NOT EXISTS idx_last_contact ON aircraft(last_contact);
            `);
            
            console.log('[TrackingDatabaseManager] Tables created successfully');
        } catch (error) {
            console.error('[TrackingDatabaseManager] Failed to create tables:', error);
            throw error;
        }
    }

    public async getAll<T>(query: string, params: any[] = []): Promise<T[]> {
        await this.initialize();
        return this.db!.all<T[]>(query, params);
    }
    
    public getDb(): Database {
        if (!this.db) {
            throw new Error('Database is not initialized');
        }
        return this.db;
    }

    async upsertActiveAircraftBatch(aircraftList: Aircraft[]): Promise<void> {
        await this.initialize();
    
        if (aircraftList.length === 0) {
            console.warn("[TrackingDatabaseManager] No aircraft to upsert.");
            return;
        }
    
        try {
            const placeholders = aircraftList.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))").join(", ");
            const values = aircraftList.flatMap(a => [
                a.icao24, a.latitude, a.longitude, a.altitude, a.velocity,
                a.heading, a.on_ground, a.last_contact, a.manufacturer
            ]);
    
            const sql = `
                INSERT INTO aircraft (
                    icao24, latitude, longitude, altitude, velocity, 
                    heading, on_ground, last_contact, manufacturer, updated_at
                )
                VALUES ${placeholders}
                ON CONFLICT(icao24) DO UPDATE SET
                    latitude = excluded.latitude,
                    longitude = excluded.longitude,
                    altitude = excluded.altitude,
                    velocity = excluded.velocity,
                    heading = excluded.heading,
                    on_ground = excluded.on_ground,
                    last_contact = excluded.last_contact,
                    updated_at = strftime('%s', 'now')`;
    
            await this.db!.run(sql, values);
            console.log(`[TrackingDatabaseManager] Batch upsert successful: ${aircraftList.length} aircraft.`);
        } catch (error) {
            console.error("[TrackingDatabaseManager] Failed to batch upsert aircraft:", error);
            throw error;
        }
    }
    
    public async getAircraft(icao24: string): Promise<any | null> {
        await this.initialize();
        return this.db!.get(`SELECT * FROM aircraft WHERE icao24 = ?`, [icao24]);
    }

    public async getQuery<T>(query: string, params: any[] = []): Promise<T | null> {
        await this.initialize();
        const result = await this.db!.get<T>(query, params);
        return result || null;
    }
    
    public async getStaleAircraft(): Promise<{ icao24: string }[]> {
        await this.initialize();
        const staleThreshold = Date.now() - 5 * 60 * 1000; // 5 minutes
        return this.db!.all<{ icao24: string }[]>(
            `SELECT icao24 FROM aircraft WHERE last_contact < ?`,
            [staleThreshold]
        );
    }

    public async cleanStaleRecords(staleThreshold: number): Promise<void> {
        await this.initialize();
        await this.db!.run(
            `DELETE FROM aircraft WHERE last_contact < ?`,
            [staleThreshold]
        );
        console.log(`[TrackingDatabaseManager] Cleaned stale records older than ${staleThreshold} ms.`);
    }

    public async clearDatabase(): Promise<void> {
        await this.initialize();
        await this.db!.run(`DELETE FROM aircraft`);
        console.log('[TrackingDatabaseManager] Cleared all records.');
    }

    public async stop(): Promise<void> {
        if (this.db) {
            await this.db.close();
            this.db = null;
            this.isInitialized = false;
            console.log('[TrackingDatabaseManager] Connection closed.');
        }
    }
}

export default TrackingDatabaseManager.getInstance();