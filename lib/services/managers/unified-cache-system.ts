import { CachedAircraftData } from "../../../types/base";

class UnifiedCacheService {
    private static instance: UnifiedCacheService;
    private aircraftCache: Map<string, CachedAircraftData> = new Map();
    private cache: Map<string, CachedAircraftData[]> = new Map(); // ✅ Fix: Define `cache` as a Map


    private constructor() {}

    public static getInstance(): UnifiedCacheService {
        if (!UnifiedCacheService.instance) {
            UnifiedCacheService.instance = new UnifiedCacheService();
        }
        return UnifiedCacheService.instance;
    }

    // Existing methods
    public get(icao24: string): CachedAircraftData | null {
        return this.aircraftCache.get(icao24) || null;
    }

    public set(key: string, data: CachedAircraftData | CachedAircraftData[]): void {
        if (!Array.isArray(data)) {
            data = [data]; // ✅ Wrap single object in an array
        }
        this.cache.set(key, data);
    }
    
    public getLatestData(): { aircraft: CachedAircraftData[] } {
        return { aircraft: Array.from(this.aircraftCache.values()) };
    }

    public remove(icao24: string): void {
        this.aircraftCache.delete(icao24);
    }

    public clear(): void {
        this.aircraftCache.clear();
    }

    // ✅ New Methods to fix missing properties

    /** Store aircraft data (alias for set) */
    public setAircraft(key: string, data: CachedAircraftData[]): void {
        this.setLiveData(key, data);
    }

    /** ✅ Get live aircraft data from cache */
    public getLiveData(key: string): CachedAircraftData[] | null {
        return this.cache.get(key) || null;
    }

    /** ✅ Store live aircraft data in cache */
    public setLiveData(key: string, data: CachedAircraftData[]): void {
        this.cache.set(key, data);
    }
    
}

export default UnifiedCacheService;
