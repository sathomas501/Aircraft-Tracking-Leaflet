// pages/api/aircraft/track-manufacturer.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { manufacturerTracking } from '@/lib/services/manufacturer-tracking-service';
import { errorHandler, ErrorType } from '@/lib/services/error-handler';
import { RateLimiter } from '@/lib/services/rate-limiter';
    
interface TrackResponse {
    success: boolean;
    message: string;
    aircraftCount?: number;
    tracking?: {
        isTracking: boolean;
        manufacturer: string | null;
        connectionMode: string;
        rateLimitInfo: {
            remainingRequests: number;
            remainingDaily: number;
        };
    };
}

async function getBaseUrl(): Promise<string> {
    return process.env.BASE_URL || 'http://localhost:3000';
}

async function fetchIcao24s(manufacturer: string): Promise<string[]> {
    try {
        const baseUrl = await getBaseUrl();
        const response = await axios.get(`${baseUrl}/api/aircraft/icao24s`, {
            params: { manufacturer },
        });
        return response.data.icao24List;
    } catch (error) {
        console.error('Error fetching ICAO24s:', error);
        errorHandler.handleError(
            ErrorType.DATA, 
            'Failed to fetch aircraft identifiers', 
            { manufacturer }
        );
        throw error;
    }
}

export default async function handler(
    req: NextApiRequest, 
    res: NextApiResponse<TrackResponse>
) {
    const { method, body } = req;

    switch (method) {
        case 'POST': {
            const { manufacturer } = body;

            if (!manufacturer) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Manufacturer is required.' 
                });
            }

            try {
                console.log(`[Tracking] Starting tracking for ${manufacturer}`);
                const icao24List = await fetchIcao24s(manufacturer);
                console.log(`[Tracking] Found ${icao24List.length} aircraft to track`);
                
                await manufacturerTracking.startTracking(manufacturer, icao24List);
                const status = manufacturerTracking.getTrackingStatus();
            
                return res.status(200).json({ 
                    success: true, 
                    message: `Tracking started for ${manufacturer}`,
                    aircraftCount: icao24List.length,
                    tracking: {
                        isTracking: status.isTracking,
                        manufacturer: status.manufacturer,
                        connectionMode: status.connectionMode,
                        rateLimitInfo: status.rateLimitInfo
                    }
                });
            } catch (error) {
                console.error('[Error] Failed to start tracking:', error);
                const errorMsg = error instanceof Error ? error.message : 'Failed to start tracking';
                errorHandler.handleError(
                    ErrorType.DATA,
                    errorMsg,
                    { manufacturer }
                );
                return res.status(500).json({ 
                    success: false, 
                    message: errorMsg
                });
            }
        }

        case 'DELETE': {
            manufacturerTracking.stopTracking();
            return res.status(200).json({ 
                success: true, 
                message: 'Stopped tracking.'
            });
        }

        default:
            res.setHeader('Allow', ['POST', 'DELETE']);
            return res.status(405).json({ 
                success: false, 
                message: `Method ${method} not allowed.` 
            });
    }
}

