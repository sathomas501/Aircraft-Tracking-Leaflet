import { TrackingDatabaseManager } from '../db/trackingDatabaseManager';
import { manufacturerTracking } from '../services/manufacturer-tracking-service';
import UnifiedCacheService from '../services/managers/unified-cache-system';

export class OpenSkySyncService {
    private static instance: OpenSkySyncService;
    private syncInterval: NodeJS.Timeout | null = null;
    private syncIntervalTime = 5 * 60 * 1000; // 5 minutes
    private dataExpiryTime = 15 * 60 * 1000; // 15 minutes (data older than this is stale)

    private constructor() {}

    public static getInstance(): OpenSkySyncService {
        if (!OpenSkySyncService.instance) {
            OpenSkySyncService.instance = new OpenSkySyncService();
        }
        return OpenSkySyncService.instance;
    }

    /**
     * Starts periodic syncing of stale aircraft.
     */
    public startSyncing(): void {
        if (!this.syncInterval) {
            this.syncInterval = setInterval(() => this.syncStaleAircraft(), this.syncIntervalTime);
        }
    }

    /**
     * Stops the syncing process.
     */
    public stopSyncing(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    /**
     * Syncs stale aircraft by fetching updates from OpenSky.
     */
    private async syncStaleAircraft(): Promise<void> {
        const dbManager = await TrackingDatabaseManager.getInstance();
        const cache = UnifiedCacheService.getInstance();
    
        try {
            // ✅ Step 1: Identify stale aircraft from the database (last update > 15 min ago)
            const staleAircraft = await dbManager.getAll<{ icao24: string, last_contact: number }>(
                "SELECT icao24, last_contact FROM aircraft WHERE last_contact < ?",
                [Date.now() - this.dataExpiryTime]
            );
    
            // ✅ Step 2: Remove aircraft that are already in cache (to avoid redundant polling)
            const staleIcao24s = staleAircraft
                .map(a => a.icao24)
                .filter(icao24 => !cache.get(icao24)); // Only fetch if not cached
    
            if (staleIcao24s.length > 0) {
                console.log(`[OpenSkySyncService] Fetching updates for ${staleIcao24s.length} stale aircraft.`);
                
                // ✅ Step 3: Fetch fresh data from OpenSky
                await manufacturerTracking.fetchLiveAircraft(staleIcao24s);
    
                // ✅ Step 4: After fetching new data, update cache
                staleIcao24s.forEach(icao24 => {
                    const updatedAircraft = cache.get(icao24);
                    if (updatedAircraft) {
                        dbManager.upsertActiveAircraft(icao24, updatedAircraft);
                    }
                });
    
            } else {
                console.log("[OpenSkySyncService] No stale aircraft need updates (cache hit).");
            }
    
            // ✅ Step 5: Clean up old records from the database
            await this.cleanupOldRecords();
    
        } catch (error) {
            console.error("[OpenSkySyncService] Failed to sync stale aircraft:", error);
        }
    }
    /**
     * Removes stale records from the tracking database.
     */
    private async cleanupOldRecords(): Promise<void> {
        const dbManager = await TrackingDatabaseManager.getInstance();
        const deletionThreshold = Date.now() - (24 * 60 * 60 * 1000); // Remove data older than 24 hours
    
        try {
            await dbManager.getDb().run(  // Fix: Use getDb() before calling run()
                "DELETE FROM aircraft WHERE last_contact < ?",
                [deletionThreshold]
            );
            console.log("[OpenSkySyncService] Removed expired tracking records from the database.");
        } catch (error) {
            console.error("[OpenSkySyncService] Error cleaning up old records:", error);
        }
    }
    
}
