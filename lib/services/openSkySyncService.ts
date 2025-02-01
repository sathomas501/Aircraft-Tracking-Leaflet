import { TrackingDatabaseManager } from '../db/trackingDatabaseManager';
import { manufacturerTracking } from '../services/manufacturer-tracking-service';
import UnifiedCacheService from '../services/managers/unified-cache-system';
import { AircraftPositionService, Position } from './aircraftPositionService';
import type { CachedAircraftData } from '../../types/base';
// Remove the Cleanup import if it's not needed

export class OpenSkySyncService {
    private static instance: OpenSkySyncService;
    private syncInterval: NodeJS.Timeout | null = null;
    private syncIntervalTime = 5 * 60 * 1000; // 5 minutes
    private dataExpiryTime = 15 * 60 * 1000; // 15 minutes

    private constructor() {}

    public static getInstance(): OpenSkySyncService {
        if (!OpenSkySyncService.instance) {
            OpenSkySyncService.instance = new OpenSkySyncService();
        }
        return OpenSkySyncService.instance;
    }

    private async syncStaleAircraft(): Promise<void> {
        const dbManager = await TrackingDatabaseManager.getInstance();
        const cache = UnifiedCacheService.getInstance();
        const positionService = AircraftPositionService.getInstance();
    
        try {
            const staleAircraft = await dbManager.getAll<{ icao24: string, last_contact: number }>(
                "SELECT icao24, last_contact FROM aircraft WHERE last_contact < ?",
                [Date.now() - this.dataExpiryTime]
            );
    
            const staleIcao24s: string[] = staleAircraft
                .map(a => a.icao24)
                .filter(icao24 => !cache.get(icao24));
    
            if (staleIcao24s.length > 0) {
                console.log(`[OpenSkySyncService] Fetching updates for ${staleIcao24s.length} stale aircraft.`);
    
                await positionService.pollAircraftData(async (icao24s: string[]) => {
                    // Fetch fresh data for the requested aircraft
                    for (const icao24 of icao24s) {
                        const position = positionService.getPosition(icao24);
                        if (position) {
                            const cachedData: CachedAircraftData = {
                                icao24: position.icao24,
                                latitude: position.latitude,
                                longitude: position.longitude,
                                altitude: position.altitude,
                                velocity: position.velocity,
                                heading: position.heading,
                                on_ground: position.on_ground,
                                lastUpdate: position.last_contact,
                                last_contact: position.last_contact
                            };
                            cache.set(icao24, cachedData);
                            dbManager.upsertActiveAircraft(icao24, cachedData);
                        }
                    }
                }, staleIcao24s);
            }
    
            await this.removeStaleRecords();
    
        } catch (error) {
            console.error("[OpenSkySyncService] Failed to sync stale aircraft:", error);
        }
    }

    /**
     * Removes stale records from the database
     */
    private async removeStaleRecords(): Promise<void> {
        const dbManager = await TrackingDatabaseManager.getInstance();
        const deletionThreshold = Date.now() - (24 * 60 * 60 * 1000); // 24 hours

        try {
            await dbManager.getDb().run(
                "DELETE FROM aircraft WHERE last_contact < ?",
                [deletionThreshold]
            );
            console.log("[OpenSkySyncService] Removed expired tracking records from the database.");
        } catch (error) {
            console.error("[OpenSkySyncService] Error cleaning up old records:", error);
        }
    }

    public startSyncing(): void {
        if (!this.syncInterval) {
            this.syncInterval = setInterval(() => this.syncStaleAircraft(), this.syncIntervalTime);
        }
    }

    public stopSyncing(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }
}