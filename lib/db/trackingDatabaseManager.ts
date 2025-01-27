import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import { AircraftStatus } from '@/types/database';


const TRACKING_DB_PATH = path.join(process.cwd(), 'lib', 'db', 'tracking.db');

export class TrackingDatabaseManager {
    private static instance: TrackingDatabaseManager;
    private db: Database | null = null;

    private constructor() {}

    public async getAll<T>(query: string, params: any[] = []): Promise<T[]> {
        if (!this.db) throw new Error('Database not initialized.');
    
        return this.db.all<T[]>(query, params);
    }
    
    public getDb(): Database {
        if (!this.db) {
            throw new Error('Database is not initialized');
        }
        return this.db;
    }

    // Singleton instance
    public static getInstance(): TrackingDatabaseManager {
        if (!TrackingDatabaseManager.instance) {
            TrackingDatabaseManager.instance = new TrackingDatabaseManager();
        }
        return TrackingDatabaseManager.instance;
    }

    // Initialize the database connection
    public async initialize(): Promise<void> {
        if (!this.db) {
            this.db = await open({
                filename: TRACKING_DB_PATH,
                driver: sqlite3.Database,
            });
            console.log('[TrackingDatabaseManager] Database initialized.');
        }
    }

    // Insert or update live aircraft in the tracking database
    public async upsertActiveAircraft(icao24: string, data: Partial<AircraftStatus>): Promise<void> {
        if (!this.db) throw new Error('Database not initialized.');
    
        await this.db.run(
            `INSERT INTO aircraft (icao24, latitude, longitude, altitude, velocity, heading, on_ground, last_contact)
             VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(icao24) DO UPDATE SET
                 latitude = excluded.latitude,
                 longitude = excluded.longitude,
                 altitude = excluded.altitude,
                 velocity = excluded.velocity,
                 heading = excluded.heading,
                 on_ground = excluded.on_ground,
                 last_contact = CURRENT_TIMESTAMP`,
            [
                icao24,
                data.latitude,
                data.longitude,
                data.altitude,
                data.velocity,
                data.heading,
                data.on_ground ? 1 : 0,
            ]
        );
        console.log(`[TrackingDatabaseManager] Upserted aircraft: ${icao24}`);
    }
    
    // Generic save method to insert or update aircraft data
    public async save(icao24: string, data: any): Promise<void> {
        await this.upsertActiveAircraft(icao24, data);
    }

    // Retrieve aircraft data by ICAO24
    public async getAircraft(icao24: string): Promise<any | null> {
        if (!this.db) throw new Error('Database not initialized.');

        const record = await this.db.get(`SELECT * FROM aircraft WHERE icao24 = ?`, [icao24]);
        return record ? { ...record, static_data: JSON.parse(record.static_data) } : null;
    }

    public async getQuery<T>(query: string, params: any[] = []): Promise<T | null> {
        if (!this.db) throw new Error('Database not initialized.');
    
        const result = await this.db.get<T>(query, params);
        return result || null; // Return the result or null if nothing is found
    }
    

    public async getStaleAircraft(): Promise<{ icao24: string }[]> {
        if (!this.db) throw new Error('Database not initialized.');
    
        const staleThreshold = Date.now() - 5 * 60 * 1000; // Stale if last_contact is older than 5 minutes
        const records = await this.db.all<{ icao24: string }[]>(
            `SELECT icao24 
             FROM aircraft 
             WHERE last_contact < ?`,
            [staleThreshold]
        );
    
        return records;
    }    

    public async clearActiveStatus(manufacturer: string): Promise<void> {
        if (!this.db) throw new Error('Database not initialized.');
    
        await this.db.run(
            `UPDATE aircraft
             SET is_active = 0
             WHERE manufacturer = ?`,
            [manufacturer]
        );
        console.log(`[TrackingDatabaseManager] Cleared active status for manufacturer: ${manufacturer}`);
    }
    
    

    // Clear the entire tracking database (for testing or cleanup)
    public async clearDatabase(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized.');

        await this.db.run(`DELETE FROM aircraft`);
        console.log('[TrackingDatabaseManager] Cleared all records.');
    }


    public async cleanStaleRecords(staleThreshold: number): Promise<void> {
        if (!this.db) throw new Error('Database not initialized.');

        await this.db.run(
            `DELETE FROM aircraft
             WHERE last_contact < ?`,
            [staleThreshold]
        );
        console.log(`[TrackingDatabaseManager] Cleaned stale records older than ${staleThreshold} ms.`);
    }

    // Close the database connection
    public async stop(): Promise<void> {
        if (this.db) {
            await this.db.close();
            this.db = null;
            console.log('[TrackingDatabaseManager] Connection closed.');
        }
    }
}
