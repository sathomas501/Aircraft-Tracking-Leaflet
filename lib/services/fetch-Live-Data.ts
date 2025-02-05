import { CacheManager } from '../services/managers/cache-manager'; // Ensure cache integration
import TrackingDatabaseManager from '@/lib/db/trackingDatabaseManager';  // ✅ Import the database manager
import { Aircraft, PositionData, TrackingData } from "@/types/base"; // Ensure correct types
import { PollingRateLimiter } from '@/lib/services/rate-limiter';
import { RATE_LIMITS } from '../../config/rate-limits';
import { API_CONFIG } from '@/config/api';
import { mapPositionDataToAircraft } from '@/utils/aircraft-helpers';

interface AircraftData {
    icao24: string;
    latitude: number;
    longitude: number;
    altitude: number;
    velocity: number;
    heading: number;
    on_ground: boolean;
    last_contact: number;
    manufacturer: string
}

const dbManager = TrackingDatabaseManager.getInstance();

// Initialize rate limiter
const rateLimiter = new PollingRateLimiter({
    requestsPerMinute: RATE_LIMITS.AUTHENTICATED.REQUESTS_PER_10_MIN / 10, // 60 requests per minute
    requestsPerDay: RATE_LIMITS.AUTHENTICATED.REQUESTS_PER_DAY, // 4000
    maxBatchSize: RATE_LIMITS.AUTHENTICATED.BATCH_SIZE, // 100
    minPollingInterval: RATE_LIMITS.AUTHENTICATED.MIN_INTERVAL,
    maxPollingInterval: RATE_LIMITS.AUTHENTICATED.MAX_CONCURRENT,
    retryLimit: RATE_LIMITS.AUTHENTICATED.MAX_RETRY_LIMIT,
    requireAuthentication: true // Set to true for authenticated limits
});

// lib/services/fetch-Live-Data.ts
export async function fetchLiveData(icao24s: string[]): Promise<Aircraft[]> {
    if (!icao24s?.length) return [];

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const subBatchSize = RATE_LIMITS.AUTHENTICATED.BATCH_SIZE;
    const allAircraft: Aircraft[] = [];
    
    for (let i = 0; i < icao24s.length; i += subBatchSize) {
        const batch = icao24s.slice(i, i + subBatchSize).map(id => id.toLowerCase());
        
        const queryParams = new URLSearchParams();
        queryParams.set('time', Math.floor(Date.now() / 1000).toString());
        queryParams.set('icao24', batch.join(','));
        
        const url = `${baseUrl}/api/proxy/opensky?${queryParams.toString()}`;
        console.log('[fetchLiveData] Request:', { url, batchSize: batch.length });
        
        try {
            const response = await fetch(url);
            console.log('[fetchLiveData] Response:', response.status);
            
            if (!response.ok) continue;

            const data = await response.json();
            if (data?.states?.length) {
                interface StateData {
                    icao24: string;
                    latitude: number | null;
                    longitude: number | null;
                    altitude: number | null;
                    heading: number | null;
                    velocity: number | null;
                    on_ground: boolean | null;
                    last_contact: number | null;
                }

                interface MappedAircraft extends Aircraft {
                    "N-NUMBER": string;
                    manufacturer: string;
                    model: string;
                    operator: string;
                    lastSeen: number;
                    NAME: string;
                    CITY: string;
                    STATE: string;
                    OWNER_TYPE: string;
                    TYPE_AIRCRAFT: string;
                    isTracked: boolean;
                }

                allAircraft.push(...data.states.map((state: StateData) => ({
                    icao24: state.icao24,
                    "N-NUMBER": '',
                    manufacturer: "Unknown",
                    model: "Unknown",
                    operator: "Unknown",
                    latitude: state.latitude || 0,
                    longitude: state.longitude || 0,
                    altitude: state.altitude || 0,
                    heading: state.heading || 0,
                    velocity: state.velocity || 0,
                    on_ground: state.on_ground || false,
                    last_contact: state.last_contact || Math.floor(Date.now() / 1000),
                    lastSeen: Math.floor(Date.now() / 1000),
                    NAME: '',
                    CITY: '',
                    STATE: '',
                    OWNER_TYPE: 'Unknown',
                    TYPE_AIRCRAFT: 'Unknown',
                    isTracked: true
                } as MappedAircraft)));
            }
        } catch (error) {
            console.error('[fetchLiveData] Error:', error);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return allAircraft;
}

const cacheManager = new CacheManager<AircraftData>(60); // Set cache TTL to 60 seconds

// In fetch-Live-Data.ts
export async function fetchAircraftPositions(icao24s: string[]): Promise<PositionData[]> {
    if (icao24s.length === 0) {
        console.warn("[fetchAircraftPositions] No ICAO24s provided.");
        return [];
    }
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const subBatchSize = API_CONFIG.PARAMS.MAX_ICAO_QUERY; // 50 ICAOs per request
    const superBatchSize = API_CONFIG.PARAMS.MAX_TOTAL_ICAO_QUERY; // 1000 ICAOs per full request
    const timeParam = Math.floor(Date.now() / 1000);
    
    let allAircraftData: PositionData[] = [];

    console.log(`[fetchAircraftPositions] Processing ${icao24s.length} ICAO24s`);

    // Split ICAOs into super batches (1000 each)
    const superBatches: string[][] = [];
    for (let i = 0; i < icao24s.length; i += superBatchSize) {
        superBatches.push(icao24s.slice(i, i + superBatchSize));
    }

    console.log(`[fetchAircraftPositions] Created ${superBatches.length} super batches`);

    // Process each super batch sequentially
    for (let superBatchIndex = 0; superBatchIndex < superBatches.length; superBatchIndex++) {
        const superBatch = superBatches[superBatchIndex];

        // Split super batch into sub-batches (50 each)
        for (let i = 0; i < superBatch.length; i += subBatchSize) {
            const batch = superBatch.slice(i, i + subBatchSize);
            console.log(`[fetchAircraftPositions] Processing batch ${Math.ceil(i/subBatchSize) + 1}/${Math.ceil(superBatch.length/subBatchSize)}`);

            try {
                // Use our proxy instead of direct OpenSky access
                const queryParams = new URLSearchParams({
                    time: timeParam.toString(),
                    icao24: batch.join(",")
                });

                const proxyUrl = `${baseUrl}/api/proxy/opensky?${queryParams}`;
                console.log(`[fetchAircraftPositions] Requesting via proxy:`, proxyUrl);

                const response = await fetch(proxyUrl);
                console.log(`[fetchAircraftPositions] Proxy response status:`, response.status);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`[fetchAircraftPositions] Proxy error: ${response.status}`, errorText);
                    if (response.status === 429) {
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    }
                    continue;
                }

                const data = await response.json();
                console.log(`[fetchAircraftPositions] Retrieved ${data.states?.length ?? 0} aircraft states`);

                if (data.states && Array.isArray(data.states)) {
                    allAircraftData.push(...data.states.map((state: any[]) => ({
                        icao24: state[0],
                        latitude: state[6] ?? 0,
                        longitude: state[5] ?? 0,
                        altitude: state[7] ?? 0,
                        velocity: state[9] ?? 0,
                        heading: state[10] ?? 0,
                        on_ground: state[8] ?? false,
                        last_contact: state[4] ?? timeParam,
                    })));
                }

                // Add delay between requests
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.error("[fetchAircraftPositions] Error:", error);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    console.log(`[fetchAircraftPositions] Total aircraft retrieved: ${allAircraftData.length}`);
    return allAircraftData;
}

// 🔹 Store Updated Aircraft Data in the Tracking Database
async function processAndStoreAircraftData(icao24s: string[]): Promise<void> {
    try {
        const liveAircraftList: PositionData[] = await fetchAircraftPositions(icao24s);
        console.log("[processAndStoreAircraftData] Processed aircraft data:", liveAircraftList);

        if (liveAircraftList.length > 0) {
            const mappedAircraftList: Aircraft[] = mapPositionDataToAircraft(liveAircraftList);

            // ✅ Transform Aircraft[] to TrackingData[]
            const trackingData: TrackingData[] = mappedAircraftList.map((aircraft: Aircraft) => ({
                icao24: aircraft.icao24,
                latitude: aircraft.latitude,
                longitude: aircraft.longitude,
                altitude: aircraft.altitude,
                velocity: aircraft.velocity,
                heading: aircraft.heading,
                on_ground: aircraft.on_ground,
                last_contact: aircraft.last_contact,
                updated_at: Date.now()  // ✅ Add updated_at timestamp
            }));

            // ✅ Upsert the transformed tracking data
            await dbManager.upsertActiveAircraftBatch(trackingData);
            console.log(`[processAndStoreAircraftData] Successfully upserted ${trackingData.length} aircraft records.`);
        } else {
            console.warn("[processAndStoreAircraftData] No valid aircraft data to insert.");
        }
    } catch (error) {
        console.error("[processAndStoreAircraftData] Error processing aircraft data:", error);
    }
}

export { processAndStoreAircraftData  };