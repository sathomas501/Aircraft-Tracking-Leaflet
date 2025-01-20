import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { chunk } from 'lodash';

// Types
interface StateResponse {
    time: number;
    states: any[];
}

interface TrackingState {
    activeManufacturer: string | null;
    trackingInterval: NodeJS.Timeout | null;
    lastRequestTime: number;
}

// Constants
const OPENSKY_BASE_URL = 'https://opensky-network.org/api';
const OPENSKY_USERNAME = process.env.OPENSKY_USERNAME;
const OPENSKY_PASSWORD = process.env.OPENSKY_PASSWORD;
const BATCH_SIZE = 100; // OpenSky API recommended batch size
const MIN_REQUEST_INTERVAL = 5000; // 5 seconds minimum between requests
const MAX_RETRIES = 3;
const TRACKING_INTERVAL = 30000; // 30 seconds between tracking updates

// Tracking state
const state: TrackingState = {
    activeManufacturer: null,
    trackingInterval: null,
    lastRequestTime: 0
};

// Helper function to enforce rate limiting
async function enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - state.lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        await new Promise(resolve => 
            setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
        );
    }
    state.lastRequestTime = Date.now();
}

async function getBaseUrl(): Promise<string> {
    return process.env.BASE_URL || 'http://localhost:3000';
}

async function fetchIcao24s(manufacturer: string): Promise<string[]> {
    const baseUrl = await getBaseUrl();
    const response = await axios.get(`${baseUrl}/api/aircraft/icao24s`, {
        params: { manufacturer },
    });
    return response.data.icao24List;
}

type FetchCallback = () => Promise<any[]>; // Define the type for the async callback

async function fetchWithRetry(
    callback: () => Promise<any[]>,
    options: { maxRetries: number; baseDelay: number; timeout: number }
): Promise<any[]> {
    const { maxRetries, baseDelay } = options;
    let attempts = 0;

    while (attempts < maxRetries) {
        try {
            console.log(`[Retry] Attempt ${attempts + 1} of ${maxRetries}`);
            const result = await callback();
            return result; // Exit loop if successful
        } catch (error: any) {
            attempts++;
            console.error(`[Retry] Error on attempt ${attempts}:`, error);

            // Handle 429 Too Many Requests
            if (error.response?.status === 429) {
                const retryAfter = error.response.headers['retry-after'];
                const delay = retryAfter
                    ? parseInt(retryAfter, 10) * 1000
                    : baseDelay * Math.pow(2, attempts); // Exponential backoff
                console.log(`[Retry] Received 429. Waiting for ${delay}ms before retrying...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
                continue;
            }

            if (attempts >= maxRetries) {
                console.error('Max retries reached');
                throw new Error('Max retries reached or non-retryable error occurred');
            }

            // Default backoff for other errors
            const delay = baseDelay * Math.pow(2, attempts);
            console.log(`[Retry] Waiting for ${delay}ms before retrying...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    return [];
}


async function fetchActiveAircraft(icao24List: string[]): Promise<any[]> {
    console.log(`[Tracking] Processing ${icao24List.length} aircraft`);
    
    const batches = chunk(icao24List, BATCH_SIZE);
    const allPositions: any[] = [];
    const failedBatches: number[] = [];

    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchKey = `batch-${i}`;

        try {
            console.log(`[OpenSky] Processing batch ${i + 1}/${batches.length} (${batch.length} aircraft)`);
            
            const positions = await fetchWithRetry(
                async () => {
                    const url = new URL(`${OPENSKY_BASE_URL}/states/all`);
                    const headers: Record<string, string> = {};
            
                    if (OPENSKY_USERNAME && OPENSKY_PASSWORD) {
                        const auth = Buffer.from(`${OPENSKY_USERNAME}:${OPENSKY_PASSWORD}`).toString('base64');
                        headers['Authorization'] = `Basic ${auth}`;
                    }
            
                    const response = await axios.get<StateResponse>(url.toString(), {
                        headers,
                        params: {
                            icao24: batch.join(','),
                        },
                    });
            
                    if (!response.data || !Array.isArray(response.data.states)) {
                        console.warn('[Warning] Unexpected response format from OpenSky');
                        return [];
                    }
            
                    return response.data.states.filter(
                        (state) => state && state[0] && batch.includes(state[0])
                    );
                },
                {
                    maxRetries: MAX_RETRIES,
                    baseDelay: MIN_REQUEST_INTERVAL,
                    timeout: 10000,
                }
            );
            
            

            if (positions && positions.length > 0) {
                allPositions.push(...positions);
            }

        } catch (error) {
            console.error(`[Error] Batch ${i + 1} failed:`, error);
            failedBatches.push(i);
            // Continue with next batch
        }
    }

    if (failedBatches.length > 0) {
        console.log(`[Warning] Failed batches: ${failedBatches.join(', ')}`);
    }

    console.log(
        `[OpenSky] Found ${allPositions.length} active aircraft ` +
        `out of ${icao24List.length} requested ` +
        `(${batches.length - failedBatches.length}/${batches.length} batches succeeded)`
    );

    return allPositions;
}

async function updatePositions(activeAircraft: any[]): Promise<void> {
    const baseUrl = await getBaseUrl();
    await axios.post(`${baseUrl}/api/aircraft/opensky-update`, { 
        states: activeAircraft 
    });
}

async function startTrackingManufacturer(
    manufacturer: string, 
    icao24List: string[]
): Promise<void> {
    if (state.trackingInterval) {
        clearInterval(state.trackingInterval);
    }

    // Initial fetch
    try {
        const activeAircraft = await fetchActiveAircraft(icao24List);
        await updatePositions(activeAircraft);
        console.log(`[Tracking] Initial fetch for ${manufacturer}: ${activeAircraft.length} active aircraft`);
    } catch (error) {
        console.error('[Error] Initial fetch failed:', error);
        throw error; // Propagate error to handler
    }

    // Start interval tracking
    state.trackingInterval = setInterval(async () => {
        try {
            const activeAircraft = await fetchActiveAircraft(icao24List);
            await updatePositions(activeAircraft);
            console.log(`[Tracking] Update for ${manufacturer}: ${activeAircraft.length} active aircraft`);
        } catch (error) {
            console.error('[Error] Update failed:', error instanceof Error ? error.message : error);
        }
    }, TRACKING_INTERVAL);
}

function stopTrackingManufacturer(): void {
    if (state.trackingInterval) {
        clearInterval(state.trackingInterval);
        console.log('[Tracking] Stopped tracking manufacturer');
    }
    state.trackingInterval = null;
    state.activeManufacturer = null;
}

export default async function handler(
    req: NextApiRequest, 
    res: NextApiResponse
) {
    const { method, body } = req;

    switch (method) {
        case 'POST': {
            const { manufacturer } = body;

            if (!manufacturer) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Manufacturer is required.' 
                });
            }

            // Stop existing tracking if switching manufacturers
            if (state.activeManufacturer && state.activeManufacturer !== manufacturer) {
                stopTrackingManufacturer();
            }
            
            try {
                console.log(`[Tracking] Starting tracking for ${manufacturer}`);
                const icao24List = await fetchIcao24s(manufacturer);
                console.log(`[Tracking] Found ${icao24List.length} aircraft to track`);
                
                await startTrackingManufacturer(manufacturer, icao24List);
                state.activeManufacturer = manufacturer;
            
                return res.status(200).json({ 
                    success: true, 
                    message: `Tracking started for ${manufacturer}`,
                    aircraftCount: icao24List.length,
                });
            } catch (error) {
                console.error('[Error] Failed to start tracking:', error);
                return res.status(500).json({ 
                    success: false, 
                    message: error instanceof Error ? error.message : 'Failed to start tracking',
                });
            }
        }

        case 'DELETE': {
            stopTrackingManufacturer();
            return res.status(200).json({ 
                success: true, 
                message: 'Stopped tracking.' 
            });
        }

        default:
            res.setHeader('Allow', ['POST', 'DELETE']);
            return res.status(405).json({ 
                success: false, 
                message: `Method ${method} not allowed.` 
            });
    }
}