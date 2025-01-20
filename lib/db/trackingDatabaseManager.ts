import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';

// Only load sqlite3 on server side
let sqlite3: typeof import('sqlite3') | null = null;
if (typeof window === 'undefined') {
    try {
        sqlite3 = require('sqlite3');
    } catch (error) {
        console.error('[Database] Failed to load sqlite3:', error);
    }
}

const TRACKING_DB_PATH = path.join(process.cwd(), 'lib', 'db', 'tracking.db');
const STALE_TIME_LIMIT = 60 * 60 * 1000; // 1 hour in milliseconds

export async function getActiveDb(): Promise<Database | null> {
    if (typeof window !== 'undefined' || !sqlite3) {
        console.log('[Database] Skipping database connection in browser environment');
        return null;
    }

    try {
        // Ensure directory exists
        const dbDir = path.dirname(TRACKING_DB_PATH);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        const db = await open({
            filename: TRACKING_DB_PATH,
            driver: sqlite3.Database,
        });
        console.log('[Database] Connected to tracking database');
        return db;
    } catch (error) {
        console.error('[Database] Failed to connect to tracking database:', error);
        return null;
    }
}

export class TrackingDatabaseManager {
    private static instance: TrackingDatabaseManager;
    private db: Database | null = null;
    private cleanupInterval: NodeJS.Timeout | null = null;
    private isServer: boolean;
    private isInitialized: boolean = false;

    private constructor() {
        this.isServer = typeof window === 'undefined';
    }

    public static getInstance(): TrackingDatabaseManager {
        if (!TrackingDatabaseManager.instance) {
            TrackingDatabaseManager.instance = new TrackingDatabaseManager();
        }
        return TrackingDatabaseManager.instance;
    }

    public async initialize(): Promise<void> {
        if (this.isInitialized) return;
        
        if (!this.isServer || !sqlite3) {
            console.log('[Tracking Database] Skipping initialization in browser environment');
            return;
        }

        if (!this.db) {
            try {
                // Ensure directory exists
                const dbDir = path.dirname(TRACKING_DB_PATH);
                if (!fs.existsSync(dbDir)) {
                    fs.mkdirSync(dbDir, { recursive: true });
                }

                this.db = await open({
                    filename: TRACKING_DB_PATH,
                    driver: sqlite3.Database,
                });

                // Set SQLite optimizations
                await this.db.exec('PRAGMA journal_mode = WAL;');
                await this.db.exec('PRAGMA synchronous = NORMAL;');
                await this.db.exec('PRAGMA temp_store = MEMORY;');

                // Create the active_tracking table if it doesn't exist
                await this.db.exec(`
                    CREATE TABLE IF NOT EXISTS active_tracking (
                        icao24 TEXT PRIMARY KEY,
                        manufacturer TEXT,
                        model TEXT,
                        marker TEXT,
                        latitude REAL,
                        longitude REAL,
                        altitude REAL,
                        velocity REAL,
                        heading REAL,
                        on_ground BOOLEAN,
                        active REAL,
                        last_contact TIMESTAMP,
                        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `);

                this.isInitialized = true;
                console.log('[Tracking Database] Initialized successfully');
                this.startCleanup();
            } catch (error) {
                console.error('[Tracking Database] Initialization failed:', error);
                throw error;
            }
        }
    }

    private startCleanup(): void {
        if (!this.isServer) return;

        // Periodically clean stale data
        this.cleanupInterval = setInterval(async () => {
            try {
                if (this.db) {
                    await this.db.run('BEGIN TRANSACTION');
                    
                    const result = await this.db.run(`
                        DELETE FROM active_tracking
                        WHERE last_seen < datetime('now', '-1 hour');
                    `);
                    
                    await this.db.run('COMMIT');
                    console.log(`[Tracking Database] Cleanup completed. Removed ${result.changes} entries.`);
                }
            } catch (error) {
                if (this.db) {
                    await this.db.run('ROLLBACK');
                }
                console.error('[Tracking Database] Cleanup error:', error);
            }
        }, STALE_TIME_LIMIT);

        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref();
        }
    }

    public async upsertActiveAircraft(positions: any[], staticMarkers?: any[]): Promise<void> {
        if (!this.isServer || !this.db || positions.length === 0) return;

        try {
            await this.db.run('BEGIN TRANSACTION');

            const placeholders = positions.map(() => `
                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).join(',');

            const query = `
                INSERT INTO active_tracking (
                    icao24, manufacturer, model, marker, 
                    latitude, longitude, altitude, 
                    velocity, heading, on_ground, active, last_contact, last_seen
                ) VALUES ${placeholders}
                ON CONFLICT(icao24) DO UPDATE SET
                    latitude = excluded.latitude,
                    longitude = excluded.longitude,
                    altitude = excluded.altitude,
                    velocity = excluded.velocity,
                    heading = excluded.heading,
                    on_ground = excluded.on_ground,
                    active = excluded.active,
                    last_contact = excluded.last_contact,
                    marker = excluded.marker,
                    last_seen = CURRENT_TIMESTAMP;
            `;

            const params = positions.flatMap(pos => [
                pos.icao24,
                pos.manufacturer,
                pos.model,
                staticMarkers?.find(m => m.icao24 === pos.icao24)?.marker || null,
                pos.latitude,
                pos.longitude,
                pos.altitude,
                pos.velocity,
                pos.heading,
                pos.on_ground ? 1 : 0,
                pos.active || 1,
                pos.last_contact,
            ]);

            await this.db.run(query, params);
            await this.db.run('COMMIT');
            console.log(`[Tracking Database] Updated ${positions.length} active aircraft.`);
        } catch (error) {
            if (this.db) {
                await this.db.run('ROLLBACK');
            }
            console.error('[Tracking Database] Error updating active aircraft:', error);
            throw error;
        }
    }

    public async getActiveAircraft(manufacturer: string): Promise<any[]> {
        if (!this.isServer || !this.db) return [];

        try {
            return await this.db.all(`
                SELECT * FROM active_tracking
                WHERE manufacturer = ?
                AND last_seen > datetime('now', '-1 hour')
                ORDER BY last_seen DESC
            `, [manufacturer]);
        } catch (error) {
            console.error('[Tracking Database] Error fetching active aircraft:', error);
            return [];
        }
    }

    public async clearManufacturer(manufacturer: string): Promise<void> {
        if (!this.isServer || !this.db) return;

        try {
            await this.db.run(`
                DELETE FROM active_tracking
                WHERE manufacturer = ?;
            `, [manufacturer]);
        } catch (error) {
            console.error('[Tracking Database] Error clearing manufacturer data:', error);
            throw error;
        }
    }

    public async close(): Promise<void> {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        if (this.db) {
            try {
                await this.db.close();
                this.db = null;
                this.isInitialized = false;
            } catch (error) {
                console.error('[Tracking Database] Error closing database:', error);
                throw error;
            }
        }
    }
}

export const trackingDb = TrackingDatabaseManager.getInstance();