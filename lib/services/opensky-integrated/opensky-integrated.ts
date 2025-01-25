import NodeCache from 'node-cache';
import type { ExtendedAircraft } from './types';


class UnifiedCacheService {
    private static instance: UnifiedCacheService;
    private aircraftCache: NodeCache;

    private constructor() {
        this.aircraftCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 }); // TTL: 1 hour
    }

    static getInstance(): UnifiedCacheService {
        if (!UnifiedCacheService.instance) {
            UnifiedCacheService.instance = new UnifiedCacheService();
        }
        return UnifiedCacheService.instance;
    }

    // Save an aircraft into the cache
    setAircraft(icao24: string, aircraft: ExtendedAircraft): void {
        this.aircraftCache.set(icao24, aircraft);
    }

    // Retrieve all aircraft from the cache
    getAllAircraft(): ExtendedAircraft[] {
        return Object.values(this.aircraftCache.mget(this.aircraftCache.keys()));
    }

    // Retrieve a single aircraft by its ICAO24 code
    get(icao24: string): ExtendedAircraft | null {
        return this.aircraftCache.get<ExtendedAircraft>(icao24) || null;
    }
}

export const unifiedCache = UnifiedCacheService.getInstance();
