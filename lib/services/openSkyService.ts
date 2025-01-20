// lib/services/openSkyService.ts
import axios from 'axios';
import { errorHandler, ErrorType } from './error-handler';

const OPENSKY_BASE_URL = 'https://opensky-network.org/api';
const OPENSKY_USERNAME = process.env.OPENSKY_USERNAME;
const OPENSKY_PASSWORD = process.env.OPENSKY_PASSWORD;

export class OpenSkyManager {
    private static instance: OpenSkyManager;
    private lastRequestTime: number = 0;
    private readonly MIN_REQUEST_INTERVAL = 5000; // 5 seconds between requests

    private constructor() {}

    public static getInstance(): OpenSkyManager {
        if (!OpenSkyManager.instance) {
            OpenSkyManager.instance = new OpenSkyManager();
        }
        return OpenSkyManager.instance;
    }

    private getAuthHeaders() {
        if (OPENSKY_USERNAME && OPENSKY_PASSWORD) {
            const auth = Buffer.from(`${OPENSKY_USERNAME}:${OPENSKY_PASSWORD}`).toString('base64');
            return { Authorization: `Basic ${auth}` };
        }
        return {};
    }

    private async enforceRateLimit(): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
            await new Promise((resolve) =>
                setTimeout(resolve, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest)
            );
        }
        this.lastRequestTime = Date.now();
    }

    public async fetchPositions(icao24List: string[]): Promise<any[]> {
        try {
            await this.enforceRateLimit();

            if (!icao24List.length) {
                console.log('No ICAO24s provided');
                return [];
            }

            console.log(`[DEBUG] Fetching positions for ${icao24List.length} aircraft`);

            const url = new URL(`${OPENSKY_BASE_URL}/states/all`);
            url.searchParams.append('icao24', icao24List.join(','));

            const response = await axios.get(url.toString(), {
                headers: this.getAuthHeaders(),
                timeout: 10000, // 10 second timeout
            });

            if (response.data && Array.isArray(response.data.states)) {
                console.log(`[DEBUG] Found ${response.data.states.length} active aircraft positions`);
                return response.data.states;
            }

            return [];
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 429) {
                    errorHandler.handleError(ErrorType.RATE_LIMIT, 'OpenSky rate limit exceeded');
                } else if (error.response?.status === 403) {
                    errorHandler.handleError(ErrorType.AUTH, 'OpenSky authentication failed');
                } else if (error.code === 'ECONNABORTED') {
                    errorHandler.handleError(ErrorType.NETWORK, 'OpenSky request timeout');
                } else {
                    errorHandler.handleError(ErrorType.NETWORK, `OpenSky request failed: ${error.message}`);
                }
            } else {
                errorHandler.handleError(
                    ErrorType.DATA,
                    'Failed to fetch positions from OpenSky',
                    error instanceof Error ? error : new Error('Unknown error')
                );
            }
            console.error('[ERROR] Failed to fetch positions:', error);
            return [];
        }
    }

    public async getAircraft(icao24: string): Promise<any | null> {
        if (!icao24) {
            throw new Error('ICAO24 identifier is required');
        }

        const positions = await this.fetchPositions([icao24]);
        return positions.length > 0 ? positions[0] : null; // Return the first match or null
    }
}


export const openSkyManager = OpenSkyManager.getInstance();