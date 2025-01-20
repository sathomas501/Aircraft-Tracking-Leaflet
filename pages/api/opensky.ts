import type { NextApiRequest, NextApiResponse } from 'next';
import { OpenSkyManager } from '@/lib/services/openSkyService';

const openSkyService = OpenSkyManager.getInstance();

function handleWebSocket(server: any): void {
    server.on('connection', (wsClient: any) => {
        (openSkyService as any).addClient(wsClient);

        wsClient.on('close', () => {
            console.log('WebSocket client disconnected');
            (openSkyService as any).removeClient(wsClient);
        });

        const pingInterval = setInterval(() => {
            if (wsClient.isAlive === false) {
                wsClient.terminate();
                clearInterval(pingInterval);
                return;
            }
            wsClient.isAlive = false;
            wsClient.ping();
        }, 30000);

        wsClient.on('close', () => {
            clearInterval(pingInterval);
        });
    });
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { icao24s } = req.query;

    if (!icao24s || (typeof icao24s !== 'string' && !Array.isArray(icao24s))) {
        return res.status(400).json({ error: 'Missing or invalid icao24s parameter' });
    }

    try {
        // Ensure icaoList is an array
        const icaoList = Array.isArray(icao24s) ? icao24s : icao24s.split(',');

        // Get OpenSkyManager instance
        const openSkyManager = OpenSkyManager.getInstance();

        // Handle each ICAO24 separately if `getAircraft` supports only single string arguments
        const positions = await Promise.all(
            icaoList.map((icao24) => openSkyManager.getAircraft(icao24))
        );

        res.status(200).json({ aircraft: positions.filter(Boolean) }); // Filter out null/undefined
    } catch (error) {
        console.error('OpenSky API error:', error);
        res.status(500).json({ error: 'Failed to fetch from OpenSky' });
    }
}

export const config = {
    api: {
        bodyParser: false,
    },
};
