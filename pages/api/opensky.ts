import type { NextApiRequest, NextApiResponse } from 'next';
import { PollingService } from '@/lib/services/polling-service';
import { subscribe, startPolling } from '@/lib/services/polling-service';   
import { OPENSKY_CONSTANTS } from '../../constants/opensky';
import type { PositionData } from '@/types/base';
import { RATE_LIMITS } from '@/config/rate-limits';
import { API_CONFIG } from '@/config/api';

let pollingService: PollingService | null = null;

function getPollingService(): PollingService {
    if (!pollingService) {
        pollingService = new PollingService({
            url: API_CONFIG.BASE_URL,
            pollingInterval: RATE_LIMITS.AUTHENTICATED.REQUESTS_PER_MINUTE * 1000,
            batchSize: RATE_LIMITS.AUTHENTICATED.BATCH_SIZE,
            authRequired: true
        });
    }
    return pollingService;
}

interface OpenSkyResponse {
    data?: PositionData[];
    error?: string;
    message?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.status(200).end(); // Respond with 200 to preflight
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { body, query } = req; // Extract `body` and `query` from `req`

        const service = getPollingService();
        const icao24s = Array.isArray(body?.icao24s)
            ? body.icao24s
            : query.icao24s
            ? [query.icao24s]
            : [];

            subscribe(
                (data: PositionData[]) => {
                    res.status(200).json({ data });
                },
                (error: Error) => {
                    throw error;
                }
            );
            startPolling(icao24s);
        
    } catch (error) {
        console.error('OpenSky API error:', error);
        res.status(500).json({
            error: 'Failed to fetch OpenSky data',
            message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        });
    }
}
