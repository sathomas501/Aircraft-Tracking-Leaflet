import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';

const TRACKING_DB_PATH = path.join(process.cwd(), 'lib', 'db', 'tracking.db');

export class TrackingDatabaseManager {
    private static instance: TrackingDatabaseManager;
    private db: Database | null = null;

    private constructor() {}

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
            console.log('[Database] Initialized successfully.');
        }
    }

    // Cleanup stale records older than the provided threshold
    public async cleanStaleRecords(staleThreshold: number): Promise<void> {
        if (!this.db) throw new Error('Database not initialized.');

        await this.db.run(`DELETE FROM aircraft WHERE last_contact < ?`, [staleThreshold]);
        console.log(`[TrackingDatabaseManager] Cleaned stale records older than ${staleThreshold}`);
    }

    // Start the database connection
    public async start(): Promise<void> {
        console.log('[Database] Starting...');
        await this.initialize();
    }

    // Stop the database connection
    public async stop(): Promise<void> {
        if (this.db) {
            await this.db.close();
            this.db = null;
            console.log('[Database] Connection closed.');
        }
    }
}
