import { getActiveDb } from '@/lib/db/databaseManager';
import { OpenSkyManager } from '@/lib/services/openSkyService';
import { CacheManager } from '@/lib/services/managers/cache-manager'; // A
import type { PositionData } from '@/types/base';

export class ManufacturerTrackingService {
    private static instance: ManufacturerTrackingService;
    private cache: CacheManager<PositionData[]> = new CacheManager<PositionData[]>(60); // Cache TTL: 60 seconds
    private currentManufacturer: string | null = null;

    // Private constructor for singleton pattern
    private constructor() {}

    /**
     * Singleton instance accessor
     */
    public static getInstance(): ManufacturerTrackingService {
        if (!ManufacturerTrackingService.instance) {
            ManufacturerTrackingService.instance = new ManufacturerTrackingService();
        }
        return ManufacturerTrackingService.instance;
    }

    /**
     * Starts tracking aircraft for a specific manufacturer.
     * @param manufacturer - Manufacturer name
     */
    public async startTracking(manufacturer: string): Promise<void> {
        if (this.currentManufacturer !== manufacturer) {
            console.log(`[DEBUG] Switching to manufacturer: ${manufacturer}`);
            this.currentManufacturer = manufacturer;

            // Reset cache for the new manufacturer
            this.cache.flush();
        } else {
            console.log(`[DEBUG] Already tracking manufacturer: ${manufacturer}`);
        }
    }

    /**
     * Fetches active aircraft positions for a list of ICAO24 identifiers.
     * @param icao24List - List of ICAO24 aircraft identifiers
     * @returns Promise<PositionData[]> - List of position data for active aircraft
     */
    public async getActiveAircraft(manufacturer: string): Promise<PositionData[]> {
        const db = await getActiveDb();
    
        const query = `
            SELECT DISTINCT icao24
            FROM aircraft
            WHERE manufacturer = ?
              AND icao24 IS NOT NULL
              AND LENGTH(TRIM(icao24)) > 0
        `;
        const aircraft = await db.all(query, [manufacturer]);
        const icao24List = aircraft.map((a: { icao24: string }) => a.icao24);
    
        if (!icao24List.length) {
            console.warn(`[WARN] No ICAO24 identifiers found for manufacturer: ${manufacturer}`);
            return [];
        }
    
        const positions = await OpenSkyService.getInstance().fetchPositions(icao24List);
    
        console.log(`[DEBUG] Found ${positions.length} active aircraft for manufacturer: ${manufacturer}`);
        return positions;
    }
    
    

    /**
     * Stops tracking the current manufacturer.
     */
    public async stopTracking(): Promise<void> {
        if (this.currentManufacturer) {
            console.log(`[DEBUG] Stopping tracking for manufacturer: ${this.currentManufacturer}`);
            this.currentManufacturer = null;

            // Clear the cache when stopping tracking
            this.cache.flush();
        } else {
            console.log('[DEBUG] No manufacturer is currently being tracked');
        }
    }
}

