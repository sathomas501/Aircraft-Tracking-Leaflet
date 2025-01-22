import { getActiveDb } from '@/lib/db/trackingDatabaseManager';
import { openSkyManager } from '@/lib/services/opensky/service';
import type { PositionData } from '@/types/base';
import type { Database } from 'sqlite';

export class OpenSkySyncService {
    private static instance: OpenSkySyncService;
    private syncInterval: NodeJS.Timeout | null = null;
    private readonly syncIntervalTime = 15000; // 15 seconds
    private isServer: boolean;

    private constructor() {
        this.isServer = typeof window === 'undefined';
    }

    public static getInstance(): OpenSkySyncService {
        if (!OpenSkySyncService.instance) {
            OpenSkySyncService.instance = new OpenSkySyncService();
        }
        return OpenSkySyncService.instance;
    }

    private async withDatabase<T>(
        operation: (db: Database) => Promise<T>,
        useTransaction: boolean = true
    ): Promise<T | null> {
        if (!this.isServer) {
            console.log('[OpenSky Sync] Skipping database operation in browser environment');
            return null;
        }
    
        const db = await getActiveDb();
        if (!db) {
            console.error('[OpenSky Sync] Failed to get database connection');
            return null;
        }
    
        try {
            if (useTransaction) {
                await db.run('BEGIN TRANSACTION');
            }
            
            const result = await operation(db);
            
            if (useTransaction) {
                await db.run('COMMIT');
            }
            
            return result;
        } catch (error) {
            if (useTransaction) {
                await db.run('ROLLBACK');
            }
            console.error('[OpenSky Sync] Database operation failed:', error);
            throw error;
        } finally {
            try {
                await db.close();
            } catch (error) {
                console.error('[OpenSky Sync] Error closing database connection:', error);
            }
        }
    }

    private async updateActiveAircraft(positions: PositionData[]): Promise<void> {
        if (positions.length === 0) return;
    
        await this.withDatabase(async (db) => {
            for (const position of positions) {
                if (!position.icao24) continue;
    
                await db.run(
                    `
                    INSERT INTO active_tracking (
                        icao24,
                        last_contact,
                        latitude,
                        longitude,
                        altitude,
                        velocity,
                        heading,
                        on_ground
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(icao24) DO UPDATE SET
                        last_contact = ?,
                        latitude = ?,
                        longitude = ?,
                        altitude = ?,
                        velocity = ?,
                        heading = ?,
                        on_ground = ?,
                        last_seen = CURRENT_TIMESTAMP
                    `,
                    [
                        position.icao24,
                        position.last_contact,
                        position.latitude,
                        position.longitude,
                        position.altitude,
                        position.velocity,
                        position.heading,
                        position.on_ground,
                        position.last_contact,
                        position.latitude,
                        position.longitude,
                        position.altitude,
                        position.velocity,
                        position.heading,
                        position.on_ground,
                    ]
                );
            }
    
            // Clean up stale entries (older than 2 hours)
            const staleThreshold = Math.floor(Date.now() / 1000) - 7200;
            await db.run('DELETE FROM active_tracking WHERE last_contact < ?', [staleThreshold]);
            
            console.log(`[OpenSky Sync] Updated ${positions.length} aircraft positions`);
        });
    }

    public async syncActiveAircraft(): Promise<void> {
        if (!this.isServer) return;
    
        try {
            const trackedAircraft = await this.withDatabase(async (db) => {
                return await db.all<{ icao24: string }[]>(`
                    SELECT DISTINCT icao24 
                    FROM aircraft 
                    WHERE icao24 IS NOT NULL 
                    AND LENGTH(TRIM(icao24)) > 0
                `);
            }, false);
    
            if (!trackedAircraft) {
                console.error('[OpenSky Sync] Failed to fetch tracked aircraft');
                return;
            }
    
            const icao24s = trackedAircraft.map((a) => a.icao24);
            if (icao24s.length === 0) {
                console.log('[OpenSky Sync] No aircraft to track');
                return;
            }
    
            console.log(`[OpenSky Sync] Syncing ${icao24s.length} aircraft positions.`);
    
            const positions = await openSkyManager.getPositions(icao24s).catch((error) => {
                console.error('[OpenSky Sync] Error fetching positions:', error.message || error);
                return [];
            });
    
            if (positions.length > 0) {
                await this.updateActiveAircraft(positions);
            } else {
                console.log('[OpenSky Sync] No active positions received');
            }
        } catch (error) {
            console.error('[OpenSky Sync] Error during sync:', error);
        }
    }
    

    public async startSync(): Promise<void> {
        if (!this.isServer) return;

        if (this.syncInterval) {
            console.log('[OpenSky Sync] Sync already running');
            return;
        }

        console.log('[OpenSky Sync] Starting sync service');
        await this.syncActiveAircraft(); // Initial sync

        this.syncInterval = setInterval(() => {
            this.syncActiveAircraft().catch((error) => {
                console.error('[OpenSky Sync] Error during scheduled sync:', error);
            });
        }, this.syncIntervalTime);

        if (this.syncInterval.unref) {
            this.syncInterval.unref();
        }
    }

    public async stopSync(): Promise<void> {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            console.log('[OpenSky Sync] Sync service stopped');
        }
    }

    public getStatus(): {
        isRunning: boolean;
        syncInterval: number;
        isServer: boolean;
    } {
        return {
            isRunning: this.syncInterval !== null,
            syncInterval: this.syncIntervalTime,
            isServer: this.isServer,
        };
    }
}

export const openSkySyncService = OpenSkySyncService.getInstance();