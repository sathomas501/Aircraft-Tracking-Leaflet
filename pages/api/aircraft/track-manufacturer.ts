import type { NextApiRequest, NextApiResponse } from 'next';
import { manufacturerTracking } from '@/lib/services/manufacturer-tracking-service';
import { errorHandler, ErrorType } from '@/lib/services/error-handler';
import { PollingRateLimiter } from '@/lib/services/rate-limiter';
import { unifiedCache } from '../../../lib/services/managers/unified-cache-system';

interface TrackResponse {
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

const rateLimiter = new PollingRateLimiter({
    requestsPerMinute: 60,
    requestsPerDay: 1000,
    minPollingInterval: 5000,
    maxPollingInterval: 30000,
});

async function fetchIcao24s(manufacturer: string): Promise<string[]> {
    const data = (await unifiedCache.getLatestData()) as { aircraft: any[] };

    if (!data || !Array.isArray(data.aircraft) || data.aircraft.length === 0) {
        throw new Error('Cache is empty or invalid. Please ensure the cache is initialized.');
    }

    const icao24s = data.aircraft
        .filter((aircraft) => aircraft.manufacturer === manufacturer)
        .map((aircraft: any) => aircraft.icao24);

    if (icao24s.length === 0) {
        throw new Error(`No aircraft found for manufacturer: ${manufacturer}`);
    }

    return icao24s;
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
                    message: 'Manufacturer is required',
                });
            }

            try {
                const nextPoll = await rateLimiter.getNextAvailableSlot();
                if (rateLimiter.isRateLimited()) {
                    return res.status(429).json({
                        success: false,
                        message: 'Rate limit exceeded',
                        tracking: {
                            isTracking: false,
                            manufacturer: null,
                            pollingStatus: {
                                interval: rateLimiter.getCurrentPollingInterval(),
                                nextPoll,
                                isRateLimited: true,
                            },
                            rateLimitInfo: {
                                remainingRequests: rateLimiter.getRemainingRequests(),
                                remainingDaily: rateLimiter.getRemainingDailyRequests(),
                            },
                        },
                    });
                }

                const icao24List = await fetchIcao24s(manufacturer);
                await manufacturerTracking.startPolling(manufacturer, icao24List);
                const status = manufacturerTracking.getTrackingStatus();

                if (!status.isTracking) {
                    throw new Error(`Tracking failed to start for manufacturer: ${manufacturer}`);
                }

                return res.status(200).json({
                    success: true,
                    message: `Tracking started for ${manufacturer}`,
                    aircraftCount: icao24List.length,
                    tracking: {
                        isTracking: status.isTracking,
                        manufacturer: status.manufacturer,
                        pollingStatus: {
                            interval: rateLimiter.getCurrentPollingInterval(),
                            nextPoll,
                            isRateLimited: false,
                        },
                        rateLimitInfo: {
                            remainingRequests: rateLimiter.getRemainingRequests(),
                            remainingDaily: rateLimiter.getRemainingDailyRequests(),
                        },
                    },
                });
            } catch (error: any) {
                console.error('Error starting tracking:', error.message, error.stack);
                errorHandler.handleError(ErrorType.DATA, error.message, { manufacturer });

                return res.status(500).json({
                    success: false,
                    message: error.message || 'Failed to start tracking',
                });
            }
        }

        case 'DELETE': {
            manufacturerTracking.stopPolling();
            rateLimiter.resetPollingInterval();
            return res.status(200).json({
                success: true,
                message: 'Stopped tracking',
            });
        }

        default:
            res.setHeader('Allow', ['POST', 'DELETE']);
            return res.status(405).json({
                success: false,
                message: `Method ${method} not allowed`,
            });
    }
}
