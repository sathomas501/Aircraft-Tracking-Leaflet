
// pages/api/aircraft/opensky-update.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { useOpenSkyWebSocket } from '@/hooks/useOpenSkyWebSocket';
import { runQuery } from '@/lib/db/databaseManager';
import { trackingDb } from '@/lib/db/trackingDatabaseManager';


// Local in-memory cache
const cache: Map<string, any> = new Map();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed',
            message: 'Only POST requests are allowed',
        });
    }

    try {
        const { states } = req.body;

        if (Array.isArray(states) && states.length > 0) {
            const message = await processStates(states);
            return res.status(200).json({ success: true, message });
        }

        await startWebSocketUpdates();
        return res.status(200).json({
            success: true,
            message: 'Live updates started via WebSocket',
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Internal server error';
        console.error('Error in OpenSky update handler:', errorMessage);
        return res.status(500).json({
            error: 'Failed to update aircraft states',
            message: process.env.NODE_ENV === 'development' ? errorMessage : 'Internal server error',
        });
    }
}


async function processStates(states: any[]): Promise<string> {
    try {
        console.log('[DEBUG] Processing states:', states);

        // Upsert live data into the tracking database
        await trackingDb.upsertActiveAircraft(states);

        console.log(`[DEBUG] Updated ${states.length} aircraft states from request body.`);
        return `Updated ${states.length} aircraft states`;
    } catch (error) {
        console.error('[DEBUG] Error processing states:', error);
        throw new Error('Failed to process aircraft states.');
    }
}

async function updateActiveAircraft(state: any): Promise<void> {
    await runQuery(
        `
        UPDATE aircraft
        SET 
            active = 1,
            last_seen = datetime('now'),
            latitude = ?,
            longitude = ?,
            altitude = ?,
            velocity = ?,
            heading = ?
        WHERE icao24 = ?
        `,
        [
            state.latitude || null,
            state.longitude || null,
            state.altitude || null,
            state.velocity || null,
            state.heading || null,
            state.icao24,
        ]
    );
}

async function startWebSocketUpdates(): Promise<void> {
    try {
        const { disconnect } = useOpenSkyWebSocket({
            onData: (data) => {
                data.forEach(async (aircraft) => {
                    cache.set(aircraft.icao24, aircraft); // Update cache from WebSocket
                    await updateActiveAircraft(aircraft); // Update active aircraft in the database
                });
                console.log(`Live Update: Updated ${data.length} aircraft states via WebSocket.`);
            },
            onError: (error) => {
                const errorMessage = error instanceof Error ? error.message : 'Unknown WebSocket error';
                console.error('WebSocket Error:', errorMessage);
            },
        });

        // Optional: Use `disconnect` if needed for cleanup
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to start WebSocket updates';
        console.error('Error starting WebSocket updates:', errorMessage);
        throw new Error(errorMessage);
    }
}
