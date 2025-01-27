import type { NextApiRequest, NextApiResponse } from 'next';
import { PollingRateLimiter } from '@/lib/services/rate-limiter';
import { DatabaseManager } from '../../../lib/db/databaseManager';

const databaseManagerInstance = DatabaseManager.getInstance();

interface TrackResponse {
    data?: any;
    success: boolean;
    message: string;
    aircraftCount?: number;
    tracking?: {
        isTracking: boolean;
        manufacturer: string | null;
        pollingStatus: {
            interval: number;
            nextPoll: Date;
            isRateLimited: boolean;
        };
        rateLimitInfo: {
            remainingRequests: number;
            remainingDaily: number;
        };
    };
}

interface ICAO24Row {
    icao24: string;
 }

const rateLimiter = new PollingRateLimiter({
    requestsPerMinute: 60,
    requestsPerDay: 1000,
    minPollingInterval: 5000,
    maxPollingInterval: 30000,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse<TrackResponse>) {
    try {
        await databaseManagerInstance.initialize();

        const { method, body } = req;

        switch (method) {
            case 'POST': {
                const { manufacturer } = body;

                if (!manufacturer) {
                    return res.status(400).json({
                        success: false,
                        message: 'Manufacturer is required',
                    });
                }

                const result = await databaseManagerInstance.getManufacturerByName(manufacturer);

                if (!result) {
                    return res.status(404).json({
                        success: false,
                        message: `Manufacturer '${manufacturer}' not found.`,
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: `Manufacturer '${manufacturer}' found.`,
                    data: result, // Include `data` in the response
                });
            }

            default:
                return res.status(405).json({
                    success: false,
                    message: `The HTTP method '${method}' is not supported at this endpoint.`,
                });
        }
    } catch (error) {
        console.error('[Error] Handler encountered an issue:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error. Please try again later.',
        });
    }

async function fetchIcao24s(manufacturer: string): Promise<string[]> {
    const icao24s = await databaseManagerInstance.allQuery<ICAO24Row>(`
        SELECT DISTINCT icao24
        FROM aircraft
        WHERE manufacturer = ?
          AND icao24 IS NOT NULL
          AND icao24 != ''
    `, [manufacturer]);
 
    if (!icao24s.length) {
        throw new Error(`No aircraft found for manufacturer: ${manufacturer}`);
    }
 
    return icao24s.map(row => row.icao24);
}}
