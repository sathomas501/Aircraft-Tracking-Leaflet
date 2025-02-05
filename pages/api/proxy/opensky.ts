// pages/api/proxy/opensky.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PollingRateLimiter } from '@/lib/services/rate-limiter';
import { openSkyAuth } from '@/lib/services/opensky-auth';
import { errorHandler, ErrorType } from '@/lib/services/error-handler';
import { OPENSKY_CONSTANTS } from '../../../constants/opensky';
import { API_CONFIG } from '@/config/api';

const rateLimiter = new PollingRateLimiter({
    requestsPerMinute: OPENSKY_CONSTANTS.RATE_LIMITS.AUTHENTICATED.REQUESTS_PER_10_MIN / 10,
    requestsPerDay: OPENSKY_CONSTANTS.RATE_LIMITS.AUTHENTICATED.REQUESTS_PER_DAY,
    maxBatchSize: OPENSKY_CONSTANTS.RATE_LIMITS.AUTHENTICATED.MAX_BATCH_SIZE,
    minPollingInterval: API_CONFIG.API.MIN_POLLING_INTERVAL,
    maxPollingInterval: API_CONFIG.API.MAX_POLLING_INTERVAL,
    maxWaitTime: API_CONFIG.API.TIMEOUT_MS,
    retryLimit: API_CONFIG.API.DEFAULT_RETRY_LIMIT,
    requireAuthentication: true
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    console.log("[OpenSky Proxy] Starting request handling");

    if (req.method !== 'GET') {
        return res.status(405).json({ 
            error: "Method Not Allowed. Use GET.",
            errorType: ErrorType.OPENSKY_SERVICE 
        });
    }

    const { icao24 } = req.query;
    if (!icao24 || (typeof icao24 === 'string' && icao24.trim() === '')) {
        return res.status(200).json({ 
            time: Math.floor(Date.now() / 1000),
            states: [] 
        });
    }

    try {
        // Authentication check
        const authResult = await openSkyAuth.ensureAuthenticated();
        if (!authResult) {
            return res.status(401).json({
                error: "Failed to authenticate with OpenSky",
                errorType: ErrorType.OPENSKY_AUTH
            });
        }

        // Rate limit check
        if (rateLimiter.isRateLimited()) {
            const nextSlot = await rateLimiter.getNextAvailableSlot();
            return res.status(429).json({
                error: "Rate limit reached",
                errorType: ErrorType.OPENSKY_RATE_LIMIT,
                nextAvailable: nextSlot,
                retryAfter: Math.ceil((nextSlot.getTime() - Date.now()) / 1000)
            });
        }

        // Handle consecutive failures
        if (rateLimiter.shouldReset()) {
            await rateLimiter.waitForBackoff();
        }

        const timeParam = Math.floor(Date.now() / 1000);
        const formattedIcaos = (Array.isArray(icao24) ? icao24 : [icao24])
            .map(code => code.toLowerCase().trim())
            .filter(code => /^[0-9a-f]{6}$/.test(code));

        if (formattedIcaos.length === 0) {
            return res.status(200).json({ 
                time: timeParam,
                states: [] 
            });
        }

        // Use rate limiter's schedule method for the actual API call
        let responseData: any;
        await rateLimiter.schedule(async () => {
            const openSkyUrl = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ALL_STATES}?time=${timeParam}&icao24=${formattedIcaos.join(',')}`;
            console.log('[OpenSky Proxy] Request URL:', openSkyUrl);

            const response = await fetch(openSkyUrl, {
                headers: {
                    ...openSkyAuth.getAuthHeaders(),
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`OpenSky API error: ${response.status}`);
            }

            responseData = await response.json();
        });

        rateLimiter.recordSuccess();
        return res.status(200).json({
            states: responseData.states || [],
            time: responseData.time || timeParam
        });

    } catch (error) {
        rateLimiter.recordFailure();
        console.error("[OpenSky Proxy] Error:", error);

        const errorResponse = {
            error: error instanceof Error ? error.message : "Failed to fetch data from OpenSky",
            errorType: ErrorType.OPENSKY_SERVICE,
            retryAfter: Math.ceil(rateLimiter.getTimeUntilNextSlot() / 1000)
        };

        return res.status(503).json(errorResponse);
    }
}