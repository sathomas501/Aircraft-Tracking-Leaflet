import { CacheManager } from './cache-manager';
import { enhancedCache } from './enhanced-cache';
import { aircraftCache } from './aircraft-cache';
import { cachePreloader } from './cache-preloader';
import type { Aircraft, PositionData } from '@/types/base';
import type { OpenSkyAircraft } from '@/types/opensky';

class IntegratedCacheService {
    private static instance: IntegratedCacheService;
    private positionCache: CacheManager<PositionData>;
    private aircraftByRegion: Map<string, Set<string>> = new Map();
    private readonly POSITION_TTL = 30;
    private readonly AIRCRAFT_TTL = 300;
    private isUpdating = false;  // Add this line

    constructor() {
        this.positionCache = new CacheManager<PositionData>(this.POSITION_TTL);
        this.initializeListeners();
     }

    static getInstance(): IntegratedCacheService {
        if (!IntegratedCacheService.instance) {
            IntegratedCacheService.instance = new IntegratedCacheService();
        }
        return IntegratedCacheService.instance;
    }

    private initializeListeners(): void {
        enhancedCache.onUpdate((aircraft: Aircraft[]) => {
            aircraft.forEach(plane => {
                const position = this.convertAircraftToPosition(plane);
                this.positionCache.set(plane.icao24, position);
                // Remove enhancedCache.set to break the loop
            });
        });
    }

    async getPosition(icao24: string): Promise<PositionData | undefined> {
        // Check CacheManager first (shortest TTL)
        const cachedPosition = this.positionCache.get(icao24);
        if (cachedPosition) return cachedPosition;

        // Check enhancedCache next
        const enhancedData = await enhancedCache.get(icao24);
        if (enhancedData) {
            const position = this.convertAircraftToPosition(enhancedData);
            this.positionCache.set(icao24, position);
            return position;
        }

        // Check aircraftCache last
        const aircraftData = aircraftCache.getLatestData().aircraft
            .find(a => a.icao24 === icao24);
        if (aircraftData) {
            const position = this.convertOpenSkyAircraftToPosition(aircraftData);
            this.positionCache.set(icao24, position);
            return position;
        }

        return undefined;
    }

    async getAircraftInRegion(region: string): Promise<Aircraft[]> {
        const regionData = aircraftCache.getRegionData(region);
        if (!regionData) return [];

        const icao24Set = this.aircraftByRegion.get(region) || new Set();
        const aircraft: Aircraft[] = [];

        for (const icao24 of icao24Set) {
            const enhancedData = await enhancedCache.get(icao24);
            if (enhancedData) {
                aircraft.push(enhancedData);
            }
        }

        return aircraft;
    }

    updatePosition(aircraft: Aircraft): void {
        if (this.isUpdating) return;
        
        this.isUpdating = true;
        const position = this.convertAircraftToPosition(aircraft);
        this.positionCache.set(aircraft.icao24, position);
        enhancedCache.set(aircraft.icao24, aircraft);
        this.isUpdating = false;
    }

    updateFromWebSocket(data: OpenSkyAircraft[]): void {
        aircraftCache.updateFromWebSocket(data);
        data.forEach(aircraft => {
            const position = this.convertOpenSkyAircraftToPosition(aircraft);
            this.positionCache.set(aircraft.icao24, position);
        });
    }

    async preloadRegion(region: string, config?: any): Promise<void> {
        await cachePreloader.preloadCache({
            regions: [{ description: region, ...config }]
        });
        
        // Update region tracking
        const regionData = aircraftCache.getRegionData(region);
        if (regionData) {
            const icao24Set = new Set(regionData.aircraft.map(a => a.icao24));
            this.aircraftByRegion.set(region, icao24Set);
        }
    }

    private convertAircraftToPosition(aircraft: Aircraft): PositionData {
        return {
            icao24: aircraft.icao24,
            latitude: aircraft.latitude,
            longitude: aircraft.longitude,
            altitude: aircraft.altitude,
            velocity: aircraft.velocity,
            heading: aircraft.heading,
            on_ground: aircraft.on_ground,
            last_contact: aircraft.last_contact
        };
    }

    private convertOpenSkyAircraftToPosition(aircraft: OpenSkyAircraft): PositionData {
        return {
            icao24: aircraft.icao24,
            latitude: aircraft.latitude || 0,
            longitude: aircraft.longitude || 0,
            altitude: aircraft.altitude || 0,
            velocity: aircraft.velocity || 0,
            heading: aircraft.heading || 0,
            on_ground: aircraft.on_ground || false,
            last_contact: aircraft.last_contact || Math.floor(Date.now() / 1000)
        };
    }

    invalidateRegion(region: string): void {
        const icao24Set = this.aircraftByRegion.get(region);
        if (icao24Set) {
            icao24Set.forEach(icao24 => {
                this.positionCache.delete(icao24);
                enhancedCache.delete(icao24);
            });
        }
        this.aircraftByRegion.delete(region);
        aircraftCache.clearRegion(region);
    }

    clear(): void {
        this.positionCache.flush();
        enhancedCache.clear();
        aircraftCache.clearCache();
        this.aircraftByRegion.clear();
    }
}

export const integratedCache = IntegratedCacheService.getInstance();