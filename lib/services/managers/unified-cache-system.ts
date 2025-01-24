// lib/services/managers/unified-cache-service.ts
import NodeCache from 'node-cache';
import { mapStateToAircraft } from '@/utils/aircraftUtils';
import type { Aircraft, PositionData } from '@/types/base';
import type { AircraftMessage } from '@/types/opensky';
import { OpenSkyStateImpl } from '@/lib/services/opensky/OpenSkyStateImpl';
import { errorHandler, ErrorType } from '../error-handler';

interface CacheConfig {
    positionTTL?: number;
    aircraftTTL?: number;
    bulkTTL?: number;
}

interface OpenSkyBulkData {
    aircraft: Array<Partial<AircraftMessage>>;
 }

class UnifiedCacheService {
    private static instance: UnifiedCacheService;
    private positionCache: NodeCache;
    private aircraftCache: NodeCache;
    private bulkCache: NodeCache;
    private updateListeners: Set<(data: Aircraft[]) => void> = new Set();
    private progressListeners: Set<(progress: number) => void> = new Set();
    private aircraftByRegion: Map<string, Set<string>> = new Map();
    private isUpdating = false;
    private isPreloading = false;
    private preloadProgress = 0;
    private staticCache: NodeCache;
    private lastUpdate: number = 0;
    private readonly STATIC_TTL = 3600;
    private readonly LIVE_TTL = 30;

    private constructor(config: CacheConfig = {}) {
        this.positionCache = new NodeCache({ stdTTL: config.positionTTL || 30 });
        this.aircraftCache = new NodeCache({ stdTTL: config.aircraftTTL || 300 });
        this.staticCache = new NodeCache({ stdTTL: config.bulkTTL || 3600 });
        this.bulkCache = new NodeCache({ stdTTL: config.bulkTTL || 3600 });
    }

    static getInstance(config?: CacheConfig): UnifiedCacheService {
        if (!UnifiedCacheService.instance) {
            UnifiedCacheService.instance = new UnifiedCacheService(config);
        }
        return UnifiedCacheService.instance;
    }

    // Position tracking
    async getPosition(icao24: string): Promise<PositionData | undefined> {
        const cachedPosition = this.positionCache.get<PositionData>(icao24);
        if (cachedPosition) return cachedPosition;

        const enhancedData = this.aircraftCache.get<Aircraft>(icao24);
        if (enhancedData) {
            const position = this.convertAircraftToPosition(enhancedData);
            this.positionCache.set(icao24, position);
            return position;
        }

        const bulkData = this.bulkCache.get<any>('latestData');
        if (bulkData?.aircraft) {
            const aircraftData = bulkData.aircraft.find((a: any) => a.icao24 === icao24);
            if (aircraftData) {
                const position = this.convertOpenSkyAircraftToPosition(aircraftData);
                this.positionCache.set(icao24, position);
                return position;
            }
        }

        return undefined;
    }

    setAircraft(icao24: string, aircraft: Aircraft): void {
        this.aircraftCache.set(icao24, aircraft);
        console.log(`[Cache] Updated aircraft ${icao24}`);
    }
    
    get(icao24: string): Aircraft | undefined {
        return this.aircraftCache.get<Aircraft>(icao24);
    }
    
    // Real-time updates
    updateFromPolling(states: OpenSkyStateImpl[]): void {
        if (!Array.isArray(states)) {
            console.warn('[Cache] Invalid polling data format');
            return;
        }

        this.isUpdating = true;
        const updatedAircraft: Aircraft[] = [];

        states.forEach(state => {
            try {
                if (state.latitude !== undefined && state.longitude !== undefined) {
                    const aircraft = mapStateToAircraft({
                        icao24: state.icao24,
                        latitude: state.latitude,
                        longitude: state.longitude,
                        baro_altitude: state.altitude,
                        velocity: state.velocity,
                        true_track: state.heading,
                        on_ground: state.on_ground,
                        last_contact: state.last_contact
                    });

                    this.positionCache.set(state.icao24, {
                        icao24: state.icao24,
                        latitude: state.latitude,
                        longitude: state.longitude,
                        altitude: state.altitude ?? 0,
                        velocity: state.velocity ?? 0,
                        heading: state.heading ?? 0,
                        on_ground: state.on_ground ?? false,
                        last_contact: state.last_contact ?? Date.now() / 1000
                    });

                    this.aircraftCache.set(state.icao24, aircraft);
                    updatedAircraft.push(aircraft);
                }
            } catch (error) {
                console.error('[Cache] State processing error:', error);
            }
        });

        this.isUpdating = false;
        this.notifyUpdateListeners(updatedAircraft);
    }

    update(data: Aircraft[]): void {
        data.forEach((aircraft) => {
            if (aircraft.icao24) {
                this.aircraftCache.set(aircraft.icao24, aircraft);
            }
        });
        console.log(`[Cache] Updated with ${data.length} aircraft`);
    }
    

    // Bulk data management
    // lib/services/managers/unified-cache-system.ts
    async setLatestData(data: OpenSkyBulkData): Promise<void> {
        console.log('[Cache] Setting data:', {
            hasData: !!data,
            aircraftCount: data?.aircraft?.length,
            sample: data?.aircraft?.[0]
        });
        this.staticCache.set('bulkData', data);
        data.aircraft?.forEach((aircraft) => {
            if (aircraft.icao24) {
                this.staticCache.set(aircraft.icao24, aircraft);
            }
        });
     }
     
     async getLatestData(): Promise<OpenSkyBulkData> {
        const data = this.staticCache.get<OpenSkyBulkData>('bulkData');
        console.log('[Cache] Getting data:', {
            hasData: !!data,
            aircraftCount: data?.aircraft?.length
        });
        if (!data?.aircraft) throw new Error('Cache is empty or invalid');
        return data;
     }

async getLatestManufacturerData(manufacturer: string): Promise<any> {
    const data = this.staticCache.get(`manufacturer:${manufacturer}`);
    if (!data) throw new Error(`No cached data for manufacturer: ${manufacturer}`);
    return data;
}

getAllAircraft(): Aircraft[] {
    const aircraftList: Aircraft[] = [];
    this.aircraftCache.keys().forEach((key) => {
        const aircraft = this.aircraftCache.get<Aircraft>(key);
        if (aircraft) {
            aircraftList.push(aircraft);
        }
    });
    return aircraftList;
}

    // Region management
    async preloadRegion(region: string, config?: any): Promise<void> {
        try {
            const response = await fetch('/api/opensky', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ region, ...config })
            });

            if (!response.ok) throw new Error(response.statusText);
            const data = await response.json();
            
            const icao24Set = new Set<string>(data.map((a: AircraftMessage) => (a.icao24 || '')).filter((id: string) => id !== ''));
            this.aircraftByRegion.set(region, icao24Set);
            
            data.forEach((aircraft: AircraftMessage) => {
                this.aircraftCache.set(aircraft.icao24, aircraft);
            });
        } catch (error) {
            errorHandler.handleError(
                ErrorType.DATA,
                error instanceof Error ? error : new Error('Unknown error'),
                { region }
            );
        }
    }

    invalidateRegion(region: string): void {
        const icao24Set = this.aircraftByRegion.get(region);
        if (icao24Set) {
            icao24Set.forEach(icao24 => {
                this.positionCache.del(icao24);
                this.aircraftCache.del(icao24);
            });
        }
        this.aircraftByRegion.delete(region);
    }

    // Event handling
    onUpdate(listener: (data: Aircraft[]) => void): () => void {
        this.updateListeners.add(listener);
        return () => this.updateListeners.delete(listener);
    }

    private notifyUpdateListeners(aircraft: Aircraft[]): void {
        this.updateListeners.forEach(listener => listener(aircraft));
    }

    updateFromRest(source: string, data: AircraftMessage[]): void {
        data.forEach(aircraft => {
            if (aircraft.icao24) {
                this.aircraftCache.set(aircraft.icao24, aircraft);
            }
        });
        console.log(`[Cache] Updated aircraft data from ${source}`);
    }
    

    // Utility methods
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

    private convertOpenSkyAircraftToPosition(aircraft: AircraftMessage): PositionData {
        return {
            icao24: aircraft.icao24,
            latitude: aircraft.latitude || 0,
            longitude: aircraft.longitude || 0,
            altitude: aircraft.altitude || 0,
            velocity: aircraft.velocity || 0,
            heading: aircraft.heading || 0,
            on_ground: aircraft.onGround || false,
            last_contact: aircraft.lastContact || Math.floor(Date.now() / 1000)
        };
    }

    clear(): void {
        this.positionCache.flushAll();
        this.aircraftCache.flushAll();
        this.bulkCache.flushAll();
        this.aircraftByRegion.clear();
    }

    getStats(): object {
        return {
            positions: this.positionCache.getStats(),
            aircraft: this.aircraftCache.getStats(),
            bulk: this.bulkCache.getStats()
        };
    }
}

export const unifiedCache = UnifiedCacheService.getInstance({
    positionTTL: 30,
    aircraftTTL: 300,
    bulkTTL: 3600
});