

class UnifiedCacheService {
    private static instance: UnifiedCacheService;
    private dataCache: Map<string, any> = new Map();
    private liveDataCache: Map<string, any> = new Map();
    private aircraftCache: Map<string, any>; // Define the aircraftCache property

    private constructor() {
        this.aircraftCache = new Map(); // Initialize the cache in the constructor
    }
    

    static getInstance(): UnifiedCacheService {
        if (!UnifiedCacheService.instance) {
            UnifiedCacheService.instance = new UnifiedCacheService();
        }
        return UnifiedCacheService.instance;
    }

    getLatestData(): { aircraft: any[] } {
        const aircraft = Array.from(this.dataCache.values());
        return { aircraft }; // Ensure this matches the structure expected by waitForCache
    }

    set(key: string, value: any): void {
        this.dataCache.set(key, value);
    }

// Method to store an aircraft in the cache
setAircraft(icao24: string, aircraft: any): void {
    console.log(`[UnifiedCache] Storing aircraft with ICAO24 "${icao24}"`);
    this.aircraftCache.set(icao24, aircraft);
}

// Method to retrieve an aircraft by ICAO24
getAircraft(icao24: string): any | null {
    console.log(`[UnifiedCache] Retrieving aircraft with ICAO24 "${icao24}"`);
    return this.aircraftCache.get(icao24) || null;
}

// Method to retrieve all cached aircraft
getAllAircraft(): any[] {
    console.log(`[UnifiedCache] Retrieving all cached aircraft`);
    return Array.from(this.aircraftCache.values());
}
    // Method to store live data in the cache
    setLiveData(key: string, data: any): void {
        console.log(`[UnifiedCache] Storing live data with key "${key}"`);
        this.liveDataCache.set(key, data);
    }

    // Method to retrieve live data from the cache
    getLiveData(key: string): any | null {
        console.log(`[UnifiedCache] Retrieving live data with key "${key}"`);
        return this.liveDataCache.get(key) || null;
    }
}

const unifiedCache = UnifiedCacheService.getInstance();
export { unifiedCache };
