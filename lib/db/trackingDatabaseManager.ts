
import { open, Database } from 'sqlite';
import path from 'path';

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

const TRACKING_DB_PATH = path.join(process.cwd(), 'lib', 'db', 'tracking.db');
const STALE_TIME_LIMIT = 60 * 60 * 1000; // 1 hour in milliseconds

export class TrackingDatabaseManager {
    private static instance: TrackingDatabaseManager;
    private db: Database | null = null;
    private cleanupInterval: NodeJS.Timeout | null = null;

    private constructor() {}

    public static getInstance(): TrackingDatabaseManager {
        if (!TrackingDatabaseManager.instance) {
            TrackingDatabaseManager.instance = new TrackingDatabaseManager();
        }
        return TrackingDatabaseManager.instance;
    }

    public async initialize(): Promise<void> {
        if (!this.db) {
            this.db = await open({
                filename: TRACKING_DB_PATH,
                driver: sqlite3.Database,
            });

            // Set SQLite performance optimizations
            await this.db.exec('PRAGMA journal_mode = WAL;');
            await this.db.exec('PRAGMA synchronous = NORMAL;');
            await this.db.exec('PRAGMA temp_store = MEMORY;');

            // Create the `active_tracking` table if it doesn't exist
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
                    active_aircraft,
                    last_contact TIMESTAMP,
                    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            console.log('[Tracking Database] Initialized.');
            this.startCleanup();
        }
    }

    private startCleanup(): void {
        // Periodically clean stale data (older than 1 hour)
        this.cleanupInterval = setInterval(async () => {
            try {
                if (this.db) {
                    const result = await this.db.run(`
                        DELETE FROM active_tracking
                        WHERE last_seen < datetime('now', '-1 hour');
                    `);
                    console.log(`[Tracking Database] Cleanup completed. Removed ${result.changes} entries.`);
                }
            } catch (error) {
                console.error('[Tracking Database] Cleanup error:', error);
            }
        }, STALE_TIME_LIMIT);
    }

    public async upsertActiveAircraft(positions: any[], staticMarkers?: any[]): Promise<void> {
        if (!this.db || positions.length === 0) return;

        const placeholders = positions.map(() => `
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).join(',');

        const query = `
            INSERT INTO active_tracking (
                icao24, manufacturer, model, marker, 
                latitude, longitude, altitude, 
                velocity, heading, on_ground, last_contact, last_seen
            ) VALUES ${placeholders}
            ON CONFLICT(icao24) DO UPDATE SET
                latitude = excluded.latitude,
                longitude = excluded.longitude,
                altitude = excluded.altitude,
                velocity = excluded.velocity,
                heading = excluded.heading,
                on_ground = excluded.on_ground,
                last_contact = excluded.last_contact,
                marker = excluded.marker,
                last_seen = CURRENT_TIMESTAMP;
        `;

        const params = positions.flatMap(pos => {
            // Fetch the marker from static data if provided
            const marker = staticMarkers?.find(m => m.icao24 === pos.icao24)?.marker || null;
            return [
                pos.icao24,
                pos.manufacturer,
                pos.model,
                marker,
                pos.latitude,
                pos.longitude,
                pos.altitude,
                pos.velocity,
                pos.heading,
                pos.on_ground ? 1 : 0,
                pos.last_contact,
            ];
        });

        await this.db.run(query, params);
        console.log(`[Tracking Database] Updated ${positions.length} active aircraft.`);
    }

    public async getActiveAircraft(manufacturer: string): Promise<any[]> {
        if (!this.db) return [];

        return this.db.all(`
            SELECT * FROM active_tracking
            WHERE manufacturer = ?
            AND last_seen > datetime('now', '-1 hour')
            ORDER BY last_seen DESC
        `, [manufacturer]);
    }

    public async clearManufacturer(manufacturer: string): Promise<void> {
        if (!this.db) return;

        await this.db.run(`
            DELETE FROM active_tracking
            WHERE manufacturer = ?;
        `, [manufacturer]);
    }

    public async close(): Promise<void> {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        if (this.db) {
            await this.db.close();
            this.db = null;
        }
    }
}

export const trackingDb = TrackingDatabaseManager.getInstance();
