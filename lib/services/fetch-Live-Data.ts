import { CacheManager } from '../services/managers/cache-manager'; // Ensure cache integration
import { errorHandler, ErrorType } from './error-handler';
import { OPENSKY_CONSTANTS } from '../../constants/opensky';
import TrackingDatabaseManager from '@/lib/db/trackingDatabaseManager';  // ✅ Import the database manager
import { Aircraft, mapPositionDataToAircraft, PositionData, TrackingData } from "@/types/base"; // Ensure correct types
import { PollingRateLimiter } from '@/lib/services/rate-limiter';

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
    requestsPerMinute: OPENSKY_CONSTANTS.AUTHENTICATED.REQUESTS_PER_10_MIN / 10, // 60 requests per minute
    requestsPerDay: OPENSKY_CONSTANTS.AUTHENTICATED.REQUESTS_PER_DAY, // 4000
    maxBatchSize: OPENSKY_CONSTANTS.AUTHENTICATED.MAX_BATCH_SIZE, // 100
    minPollingInterval: OPENSKY_CONSTANTS.API.MIN_POLLING_INTERVAL,
    maxPollingInterval: OPENSKY_CONSTANTS.API.MAX_POLLING_INTERVAL,
    retryLimit: OPENSKY_CONSTANTS.API.DEFAULT_RETRY_LIMIT,
    requireAuthentication: true // Set to true for authenticated limits
});

// lib/services/fetch-Live-Data.ts
// In fetch-Live-Data.ts
// lib/services/fetch-Live-Data.ts
export async function fetchLiveData(icao24s: string[]): Promise<Aircraft[]> {
    console.log(`[fetchLiveData] Starting fetch for ${icao24s.length} ICAO24s`);
    
    const allAircraft: Aircraft[] = [];
    
    try {
        if (!icao24s || icao24s.length === 0) {
            console.warn("[fetchLiveData] No ICAO24s provided.");
            return [];
        }

        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const subBatchSize = OPENSKY_CONSTANTS.AUTHENTICATED.MAX_ICAO_QUERY;

        for (let i = 0; i < icao24s.length; i += subBatchSize) {
            const batch = icao24s.slice(i, i + subBatchSize);
            console.log(`[fetchLiveData] Processing batch ${Math.floor(i/subBatchSize) + 1}/${Math.ceil(icao24s.length/subBatchSize)}`);

            const queryParams = new URLSearchParams({
                time: Math.floor(Date.now() / 1000).toString(),
                icao24: batch.join(","),
            });

            const proxyUrl = `${baseUrl}/api/proxy/opensky?${queryParams}`;

            try {
                const response = await fetch(proxyUrl);
                console.log(`[fetchLiveData] Proxy response status:`, response.status);

                if (!response.ok) {
                    console.error(`[fetchLiveData] Proxy error: ${response.status}`);
                    continue;
                }

                const data = await response.json();
                if (data && data.states && Array.isArray(data.states)) {
                    const mappedAircraft = data.states.map((state: any[]): Aircraft => ({
                        icao24: state[0] || '',
                        "N-NUMBER": '',  // Required field
                        manufacturer: "Unknown",
                        model: "Unknown",
                        operator: "Unknown",
                        latitude: state[6] || 0,
                        longitude: state[5] || 0,
                        altitude: state[7] || 0,
                        heading: state[10] || 0,
                        velocity: state[9] || 0,
                        on_ground: state[8] || false,
                        last_contact: state[4] || Math.floor(Date.now() / 1000),
                        lastSeen: Math.floor(Date.now() / 1000),
                        NAME: '',
                        CITY: '',
                        STATE: '',
                        OWNER_TYPE: 'Unknown',
                        TYPE_AIRCRAFT: 'Unknown',
                        isTracked: true
                    }));

                    console.log(`[fetchLiveData] Mapped ${mappedAircraft.length} aircraft from batch`);
                    allAircraft.push(...mappedAircraft);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.error("[fetchLiveData] Request error:", error);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        console.log(`[fetchLiveData] Total aircraft mapped: ${allAircraft.length}`);
        return allAircraft;

    } catch (error) {
        console.error("[fetchLiveData] General error:", error);
        return [];
    }
}

const cacheManager = new CacheManager<AircraftData>(60); // Set cache TTL to 60 seconds

// In fetch-Live-Data.ts
export async function fetchAircraftPositions(icao24s: string[]): Promise<PositionData[]> {
    if (icao24s.length === 0) {
        console.warn("[fetchAircraftPositions] No ICAO24s provided.");
        return [];
    }
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const subBatchSize = OPENSKY_CONSTANTS.AUTHENTICATED.MAX_ICAO_QUERY; // 50 ICAOs per request
    const superBatchSize = OPENSKY_CONSTANTS.AUTHENTICATED.MAX_TOTAL_ICAO_QUERY; // 1000 ICAOs per full request
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