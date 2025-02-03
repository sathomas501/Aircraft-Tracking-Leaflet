import { Aircraft, CachedAircraftData, TrackingData } from '@/types/base';
import TrackingDatabaseManager from '@/lib/db/trackingDatabaseManager';
import UnifiedCacheService from '@/lib/services/managers/unified-cache-system';
import { PollingRateLimiter } from './rate-limiter';
import { errorHandler, ErrorType } from './error-handler';
import { fetchLiveData } from './fetch-Live-Data';
 
interface ActiveAircraftData {
    icao24: string;
    latitude: number;
    longitude: number;
    altitude: number;
    velocity: number;
    heading: number;
    on_ground: boolean;
    last_contact: number;
    updated_at: number;
}

const trackingDb = TrackingDatabaseManager.getInstance();

// ✅ Fetch and Transform Data Function
const fetchAndTransformData = async (aircraft: Aircraft[]): Promise<TrackingData[]> => {
    const icao24s: string[] = aircraft.map((a: Aircraft): string => a.icao24);
    const aircraftArray: Aircraft[] = await fetchLiveData(icao24s);

    // ✅ Transform Aircraft[] to TrackingData[]
    return aircraftArray.map((aircraft: Aircraft) => ({
        icao24: aircraft.icao24,
        latitude: aircraft.latitude,
        longitude: aircraft.longitude,
        altitude: aircraft.altitude,
        velocity: aircraft.velocity,
        heading: aircraft.heading,
        on_ground: aircraft.on_ground,
        last_contact: aircraft.last_contact,
        updated_at: Date.now()
    }));
};


export class OpenSkySyncService {
    private static instance: OpenSkySyncService;
    private cache: UnifiedCacheService;
    private rateLimiter: PollingRateLimiter;
    private isPolling: boolean = false;
    private pollingInterval: NodeJS.Timeout | null = null;
    private readonly POLLING_DELAY = 5000; // 5 seconds
    private readonly MAX_BATCH_SIZE = 100;

    private constructor() {
        this.cache = UnifiedCacheService.getInstance();
        this.rateLimiter = new PollingRateLimiter({
            requestsPerMinute: 60,
            requestsPerDay: 1000,
            minPollingInterval: 5000,
            maxPollingInterval: 30000
        });
    }

    public static getInstance(): OpenSkySyncService {
        if (!OpenSkySyncService.instance) {
            OpenSkySyncService.instance = new OpenSkySyncService();
        }
        return OpenSkySyncService.instance;
    }

    private transformToActiveData(aircraft: Aircraft): Aircraft {
        const now = Date.now();
        return {
            // Core identification
            icao24: aircraft.icao24,
            "N-NUMBER": aircraft["N-NUMBER"] || "",
            manufacturer: aircraft.manufacturer || "",
            model: aircraft.model || "",
            
            // Location and movement data
            latitude: aircraft.latitude,
            longitude: aircraft.longitude,
            altitude: aircraft.altitude,
            heading: aircraft.heading,
            velocity: aircraft.velocity,
            on_ground: aircraft.on_ground,
            last_contact: aircraft.last_contact,
            lastSeen: aircraft.lastSeen || now,
    
            // Registration information
            NAME: aircraft.NAME || "",
            CITY: aircraft.CITY || "",
            STATE: aircraft.STATE || "",
            OWNER_TYPE: aircraft.OWNER_TYPE || "",
            TYPE_AIRCRAFT: aircraft.TYPE_AIRCRAFT || "",
    
            // Tracking state
            isTracked: true,
            
            // Optional fields with defaults
            operator: aircraft.operator || "",
            registration: aircraft.registration,
            manufacturerName: aircraft.manufacturerName,
            owner: aircraft.owner,
            registered: aircraft.registered,
            manufacturerIcao: aircraft.manufacturerIcao,
            operatorIcao: aircraft.operatorIcao,
            active: aircraft.active
        };
    }



    private transformToCachedData(aircraft: Aircraft): CachedAircraftData {
        const now = Date.now();
        return {
            icao24: aircraft.icao24,
            latitude: aircraft.latitude,
            longitude: aircraft.longitude,
            altitude: aircraft.altitude,
            velocity: aircraft.velocity,
            heading: aircraft.heading,
            on_ground: aircraft.on_ground,
            last_contact: aircraft.last_contact,
            lastSeen: now,
            lastUpdate: now
        };
    }

    private async processAircraftData(aircraft: Aircraft): Promise<void> {
        try {
            // ✅ Transform and update cache
            const cachedData = this.transformToCachedData(aircraft);
            this.cache.setLiveData(aircraft.icao24, [cachedData]);
    
            // ✅ Transform Aircraft to TrackingData
            const trackingData: TrackingData = {
                icao24: aircraft.icao24,
                latitude: aircraft.latitude,
                longitude: aircraft.longitude,
                altitude: aircraft.altitude,
                velocity: aircraft.velocity,
                heading: aircraft.heading,
                on_ground: aircraft.on_ground,
                last_contact: aircraft.last_contact,
                updated_at: Date.now()  // ✅ Ensure updated_at exists
            };
    
            // ✅ Update database with the transformed TrackingData
            await trackingDb.upsertActiveAircraftBatch([trackingData]);  // ✅ Wrap in an array as it expects TrackingData[]
        } catch (error) {
            console.error('Error processing aircraft data:', error);
            throw error;
        }
    }
    

    private async processBatch(aircraftBatch: Aircraft[]): Promise<void> {
        try {
            for (const aircraft of aircraftBatch) {
                await this.processAircraftData(aircraft);
            }
        } catch (error) {
            console.error('Error processing aircraft batch:', error);
            throw error;
        }
    }

    public async startSync(aircraft: Aircraft[]): Promise<void> {
        if (this.isPolling) {
            console.log('[OpenSkySync] Sync already in progress');
            return;
        }

        this.isPolling = true;
        console.log(`[OpenSkySync] Starting sync for ${aircraft.length} aircraft`);

        try {
            // Process in batches to avoid overwhelming the system
            for (let i = 0; i < aircraft.length; i += this.MAX_BATCH_SIZE) {
                const batch = aircraft.slice(i, i + this.MAX_BATCH_SIZE);
                await this.processBatch(batch);
                
                // Respect rate limits
                if (i + this.MAX_BATCH_SIZE < aircraft.length) {
                    await new Promise(resolve => setTimeout(resolve, this.POLLING_DELAY));
                }
            }
            
            // Start polling for updates
            this.startPolling(aircraft);
        } catch (error) {
            errorHandler.handleError(
                ErrorType.OPENSKY_SERVICE,
                'Error starting sync',
                { error }
            );
        }
    }

    private startPolling(aircraft: Aircraft[]): void {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }

        this.pollingInterval = setInterval(async () => {
            if (this.rateLimiter.isRateLimited()) {
                console.log('[OpenSkySync] Rate limited, skipping update');
                return;
            }

            try {
                await this.processBatch(aircraft);
                this.rateLimiter.recordRequest();
            } catch (error) {
                errorHandler.handleError(
                    ErrorType.OPENSKY_POLLING,
                    'Error during polling',
                    { error }
                );
            }
        }, this.POLLING_DELAY);
    }

    public stopSync(): void {
        console.log('[OpenSkySync] Stopping sync');
        this.isPolling = false;
        
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    public isActive(): boolean {
        return this.isPolling;
    }

    public getCache(): UnifiedCacheService {
        return this.cache;
    }


    public async cleanup(): Promise<void> {
        this.stopSync();
        this.cache.clear();
        
        try {
            // Clean up stale data from database
            const staleThreshold = Date.now() - (15 * 60 * 1000); // 15 minutes
            const result = await trackingDb.getQuery(
                'DELETE FROM active_aircraft WHERE updated_at < ?',
                [staleThreshold]
            );
        } catch (error) {
            errorHandler.handleError(
                ErrorType.OPENSKY_CLEANUP,
                'Error during cleanup',
                { error }
            );
        }
    }
}