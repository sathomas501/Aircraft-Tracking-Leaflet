// pages/api/opensky.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { OpenSkyWebSocket } from '@/lib/services/openSkyService';

// Create singleton instance
let openSkyService: OpenSkyWebSocket | null = null;

function getOpenSkyService(): OpenSkyWebSocket {
    if (!openSkyService) {
        openSkyService = new OpenSkyWebSocket();
    }
    return openSkyService;
}

interface OpenSkyResponse {
    data?: any;
    error?: string;
    message?: string;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<OpenSkyResponse>
) {
    try {
        const service = getOpenSkyService();
        const { icao24s, manufacturer } = req.query;

        // Handle different types of requests
        if (icao24s) {
            const icao24List = Array.isArray(icao24s) ? icao24s : [icao24s];
            const positions = await service.getPositions(icao24List);
            return res.status(200).json({ data: positions });
        }

        if (manufacturer) {
            const aircraft = await service.getAircraft([manufacturer as string]);
            return res.status(200).json({ data: aircraft });
        }

        // Default to getting all positions
        const positions = await service.getPositions();
        res.status(200).json({ data: positions });
    } catch (error) {
        console.error('OpenSky API error:', error);
        res.status(500).json({
            error: 'Failed to fetch data from OpenSky Network',
            message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        });
    }
}