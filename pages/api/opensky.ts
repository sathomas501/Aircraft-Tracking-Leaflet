import type { NextApiRequest, NextApiResponse } from 'next';
import { PollingService } from '@/lib/services/polling-service';
import { OPENSKY_API_CONFIG } from '@/lib/config/opensky';
import type { PositionData } from '@/types/base';

let pollingService: PollingService | null = null;

function getPollingService(): PollingService {
    if (!pollingService) {
        pollingService = new PollingService({
            url: OPENSKY_API_CONFIG.BASE_URL,
            pollingInterval: OPENSKY_API_CONFIG.RATE_LIMITS.REQUESTS_PER_MINUTE * 1000,
            batchSize: OPENSKY_API_CONFIG.RATE_LIMITS.BATCH_SIZE,
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

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<OpenSkyResponse>
) {
    const { method, query, body } = req;

    if (method !== 'POST' && method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const service = getPollingService();
        const icao24s = Array.isArray(body?.icao24s) ? body.icao24s : query.icao24s ? [query.icao24s] : [];

        await service.startPolling(
            icao24s,
            (data: PositionData[]) => {
                res.status(200).json({ data });
            },
            (error: Error) => {
                throw error;
            }
        );
    } catch (error) {
        console.error('OpenSky API error:', error);
        res.status(500).json({
            error: 'Failed to fetch OpenSky data',
            message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        });
    }
}