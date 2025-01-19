// lib/db/databaseManager.ts
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { AircraftStatus } from '@/types/database';

class DatabaseManager {
    private static instance: DatabaseManager;
    private db: Database | null = null;

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

            // Configure SQLite settings
            await this.db.exec('PRAGMA journal_mode = WAL;');
            await this.db.exec('PRAGMA busy_timeout = 30000;');
            await this.db.exec('PRAGMA synchronous = NORMAL;');
        }
        return this.db;
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

    public async updateAircraftStatus(icao24: string, status: AircraftStatus): Promise<void> {
        const db = await this.getDb();
        try {
            const query = `
                UPDATE aircraft
                SET 
                    active = 1,
                    last_seen = CURRENT_TIMESTAMP,
                    latitude = COALESCE(?, latitude),
                    longitude = COALESCE(?, longitude),
                    altitude = COALESCE(?, altitude),
                    velocity = COALESCE(?, velocity),
                    heading = COALESCE(?, heading)
                WHERE icao24 = ?
            `;

            const params = [
                status.latitude,
                status.longitude,
                status.altitude,
                status.velocity,
                status.heading,
                icao24
            ];

            await db.run(query, params);
        } catch (error) {
            console.error(`Error updating aircraft ${icao24}:`, error);
            throw error;
        }
    }

    public async closeConnection(): Promise<void> {
        if (this.db) {
            await this.db.close();
            this.db = null;
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
export const updateAircraftStatus = (icao24: string, status: AircraftStatus) => 
    databaseManagerInstance.updateAircraftStatus(icao24, status);

// Export the types
export type { Database };