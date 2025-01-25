import type { NextApiRequest, NextApiResponse } from 'next';
import StaticDatabaseManager from '../../lib/db/databaseManager';
import { PollingService } from '../../lib/services/polling-service'; // Correct import for PollingService
import { trackingDb } from '@/lib/db/trackingDatabaseManager';

interface ManufacturerData {
    name: string;
    count: number;
}

interface ActiveAircraftResponse {
    activeCount: number;
    aircraft: any[];
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<
        { manufacturers: ManufacturerData[] } | ActiveAircraftResponse | { error: string }
    >
) {
    try {
        // Handle dropdown population
        if (req.method === 'GET') {
            try {
                const staticDb = await StaticDatabaseManager.getDb();
                const manufacturers = await staticDb.all<ManufacturerData[]>(`
                    SELECT 
                        manufacturer as name,
                        COUNT(*) as count
                    FROM aircraft
                    WHERE 
                        manufacturer IS NOT NULL
                        AND manufacturer != ''
                        AND LENGTH(TRIM(manufacturer)) > 1
                    GROUP BY manufacturer
                    HAVING count >= 10
                    ORDER BY count DESC
                    LIMIT 50;
                `);
        
                console.log('[Debug] Retrieved manufacturers:', manufacturers);
        
                if (manufacturers.length === 0) {
                    console.warn('[Debug] No manufacturers found in the database');
                    return res.status(404).json({ manufacturers: [] });
                }
        
                return res.status(200).json({ manufacturers });
            } catch (error: any) {
                console.error('[Error] Failed to load manufacturers:', error.message);
                return res.status(500).json({ error: 'Internal server error' });
            }
        }
        

        // Handle active aircraft retrieval for a selected manufacturer
        if (req.method === 'POST') {
            const { manufacturer } = req.body;

            if (!manufacturer) {
                return res.status(400).json({ error: 'Manufacturer is required' });
            }

            // Fetch ICAO24 codes for the manufacturer
            const staticDb = await StaticDatabaseManager.getDb();
            const icao24List = await staticDb.all<{ icao24: string }[]>(`
                SELECT icao24
                FROM aircraft
                WHERE manufacturer = ?;
            `, [manufacturer]);

            if (icao24List.length === 0) {
                return res.status(404).json({ error: 'No aircraft found for this manufacturer' });
            }

            const icao24s = icao24List.map((row) => row.icao24);

            // Create an instance of PollingService
            const pollingService = new PollingService({
                url: 'https://opensky-network.org/api/states/all',
                pollingInterval: 30000, // 30 seconds
                batchSize: 100,
                authRequired: true,
            });

            const activeAircraft: any[] = [];
            await pollingService.startPolling(
                icao24s,
                (data) => {
                    activeAircraft.push(...data);
                },
                (error) => {
                    console.error('Polling error:', error.message);
                }
            );

            // Count active aircraft and store them in the tracking database
            for (const aircraft of activeAircraft) {
                await trackingDb.run(`
                    INSERT INTO aircraft_tracking (icao24, manufacturer, model, is_active)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(icao24) DO UPDATE SET is_active = excluded.is_active;
                `, [aircraft.icao24, manufacturer, aircraft.model, 1]);
            }

            // Return the active count and aircraft data
            return res.status(200).json({
                activeCount: activeAircraft.length,
                aircraft: activeAircraft,
            });
        }

        // If the method is neither GET nor POST
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: `Method ${req.method} is not allowed` });
    } catch (error: any) {
        console.error('Error in manufacturers API:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
