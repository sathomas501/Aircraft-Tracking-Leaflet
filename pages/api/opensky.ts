// pages/api/opensky.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import WebSocket from 'ws';
import type { OpenSkyService } from '@/lib/services/opensky-integrated/types';
import { openSkyService } from '@/lib/services/opensky-integrated/service';
let wsUpgradeHandlerInstalled = false;

function handleWebSocket(server: any) {
    if (wsUpgradeHandlerInstalled) return;
    wsUpgradeHandlerInstalled = true;

    const wss = new WebSocket.Server({ noServer: true });

    server.on('upgrade', (request: any, socket: any, head: any) => {
        if (request.url === '/api/opensky') {
            wss.handleUpgrade(request, socket, head, (ws) => {
                console.log('New WebSocket client connected');
                (openSkyService as OpenSkyService).addClient(ws);

                ws.on('close', () => {
                    console.log('WebSocket client disconnected');
                    (openSkyService as OpenSkyService).removeClient(ws);
                });
            });
        }
    });
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method === 'GET' && (req as any).socket?.server) {
        handleWebSocket((req as any).socket.server);
    }

    const { icao24s } = req.query;
    
    if (!icao24s) {
        return res.status(400).json({ error: 'Missing icao24s parameter' });
    }

    try {
        const icaoList = typeof icao24s === 'string' 
            ? icao24s.split(',')
            : Array.isArray(icao24s) 
                ? icao24s 
                : [icao24s];

        console.log('Fetching positions for', icaoList.length, 'aircraft');
        const positions = await openSkyService.getAircraft(icaoList);
        
        console.log('Retrieved positions for', positions.length, 'aircraft');
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