import { NextApiRequest, NextApiResponse } from 'next';
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

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
): Promise<void> {
    const server = (req as any).socket?.server;
    const upgradeHeader = req.headers.upgrade?.toLowerCase();

    if (server && upgradeHeader === 'websocket') {
        handleWebSocket(server);
        res.end();
        return;
    }

    const { icao24s } = req.query;

    if (!icao24s) {
        return res.status(400).json({ error: 'Missing icao24s parameter' });
    }

    try {
        const icaoList = Array.isArray(icao24s) ? icao24s : icao24s.split(',');

        const positions = await openSkyService.getAircraft(icaoList);
        res.status(200).json({ aircraft: positions });
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
