import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';


let activeManufacturer: string | null = null;
let trackingInterval: NodeJS.Timeout | null = null;

const OPENSKY_BASE_URL = 'https://opensky-network.org/api';
const OPENSKY_USERNAME = process.env.OPENSKY_USERNAME;
const OPENSKY_PASSWORD = process.env.OPENSKY_PASSWORD;

async function fetchIcao24s(manufacturer: string): Promise<string[]> {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000'; // Use appropriate base URL
    const response = await axios.get(`${baseUrl}/api/aircraft/icao24s`, {
        params: { manufacturer },
    });
    return response.data.icao24List;
}

async function fetchActiveAircraft(icao24List: string[]): Promise<any[]> {
    try {
        // Construct the URL properly
        const url = new URL(`${OPENSKY_BASE_URL}/states/all`);
        
        // Add authentication if credentials are available
        const headers: Record<string, string> = {};
        if (OPENSKY_USERNAME && OPENSKY_PASSWORD) {
            const auth = Buffer.from(`${OPENSKY_USERNAME}:${OPENSKY_PASSWORD}`).toString('base64');
            headers['Authorization'] = `Basic ${auth}`;
        }

        // Make the request with proper config
        const response = await axios.get(url.toString(), {
            headers,
            timeout: 10000, // 10 second timeout
            params: {
                icao24: icao24List.join(',')
            }
        });

        if (!response.data || !Array.isArray(response.data.states)) {
            console.warn('[Warning] Unexpected response format from OpenSky');
            return [];
        }

        // Filter for requested aircraft
        const activeStates = response.data.states.filter((state: any) => 
            state && state[0] && icao24List.includes(state[0])
        );

        console.log(`[OpenSky] Found ${activeStates.length} active aircraft out of ${icao24List.length} requested`);
        return activeStates;

    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 429) {
                console.error('[OpenSky] Rate limit exceeded');
            } else if (error.response?.status === 403) {
                console.error('[OpenSky] Authentication failed');
            } else if (error.code === 'ECONNABORTED') {
                console.error('[OpenSky] Request timeout');
            }
            throw new Error(`OpenSky API error: ${error.message}`);
        }
        throw error;
    }
}

async function startTrackingManufacturer(manufacturer: string, icao24List: string[], interval: number) {
    if (trackingInterval) clearInterval(trackingInterval);

    // Initial fetch
    try {
        const activeAircraft = await fetchActiveAircraft(icao24List);
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        await axios.post(`${baseUrl}/api/aircraft/opensky-update`, { states: activeAircraft });
        console.log(`[Tracking] Initial fetch for ${manufacturer}: ${activeAircraft.length} active aircraft`);
    } catch (error) {
        console.error('[Error] Initial fetch failed:', error);
    }

    // Start interval tracking
    trackingInterval = setInterval(async () => {
        try {
            const activeAircraft = await fetchActiveAircraft(icao24List);
            const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
            await axios.post(`${baseUrl}/api/aircraft/opensky-update`, { states: activeAircraft });

            console.log(`[Tracking] Update for ${manufacturer}: ${activeAircraft.length} active aircraft`);
        } catch (error) {
            if (error instanceof Error) {
                console.error('[Error] Failed to fetch or update aircraft states:', error.message);
            } else {
                console.error('[Error] Unknown error occurred while updating aircraft states:', error);
            }
        }
    }, interval);
}

function stopTrackingManufacturer() {
    if (trackingInterval) {
        clearInterval(trackingInterval);
        console.log('[Tracking] Stopped tracking manufacturer');
    }
    trackingInterval = null;
    activeManufacturer = null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { method, body } = req;

    switch (method) {
        case 'POST': {
            const { manufacturer, model } = body;

            if (!manufacturer) {
                return res.status(400).json({ success: false, message: 'Manufacturer is required.' });
            }

            // Stop existing tracking if switching manufacturers
            if (activeManufacturer && activeManufacturer !== manufacturer) {
                stopTrackingManufacturer();
            }
            
            try {
                console.log(`[Tracking] Starting tracking for ${manufacturer}`);
                const icao24List = await fetchIcao24s(manufacturer); // Pass only manufacturer
                console.log(`[Tracking] Found ${icao24List.length} aircraft to track`);
                
                await startTrackingManufacturer(manufacturer, icao24List, 30000);
                activeManufacturer = manufacturer;
            
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
            return res.status(200).json({ success: true, message: 'Stopped tracking.' });
        }

        default:
            res.setHeader('Allow', ['POST', 'DELETE']);
            return res.status(500).json({ success: false, message: `Method ${method} not allowed.` });
    }
}