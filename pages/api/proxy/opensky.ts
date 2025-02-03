// pages/api/proxy/opensky.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PollingRateLimiter } from '@/lib/services/rate-limiter';
import { openSkyAuth } from '@/lib/services/opensky-auth';
import { errorHandler, ErrorType } from '@/lib/services/error-handler';

const userMessages = {
    [ErrorType.OPENSKY_SERVICE]: "OpenSky service error"
};
import { OPENSKY_CONSTANTS } from '../../../constants/opensky';

// Initialize rate limiter with OpenSky's authenticated limits
const rateLimiter = new PollingRateLimiter({
    requireAuthentication: true,
    minPollingInterval: OPENSKY_CONSTANTS.API.MIN_POLLING_INTERVAL,
    maxPollingInterval: OPENSKY_CONSTANTS.API.MAX_POLLING_INTERVAL,
    maxWaitTime: OPENSKY_CONSTANTS.API.TIMEOUT_MS,
    maxBatchSize: OPENSKY_CONSTANTS.AUTHENTICATED.MAX_BATCH_SIZE,
    retryLimit: OPENSKY_CONSTANTS.API.DEFAULT_RETRY_LIMIT,
    requestsPerMinute: OPENSKY_CONSTANTS.AUTHENTICATED.REQUESTS_PER_10_MIN,
    requestsPerDay: OPENSKY_CONSTANTS.AUTHENTICATED.REQUESTS_PER_DAY
});

// pages/api/proxy/opensky.ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    console.log("[OpenSky Proxy] Starting request handling");

    try {
        if (req.method !== 'GET') {
            return res.status(405).json({ 
                error: "Method Not Allowed. Use GET.",
                errorType: ErrorType.OPENSKY_SERVICE 
            });
        }

        // Set up rate limiter with error handler
        errorHandler.setRateLimiter(rateLimiter);

        // If we've had too many failures, wait for backoff
        if (rateLimiter.shouldReset()) {
            console.log("[OpenSky Proxy] Backing off due to consecutive failures");
            await rateLimiter.waitForBackoff();
        }

        // Check rate limits
        if (rateLimiter.isRateLimited()) {
            console.log("[OpenSky Proxy] Rate limited");
            await errorHandler.handleOpenSkyError(
                new Error("Rate limit reached"),
                rateLimiter
            );
            return res.status(429).json({
                error: "Rate limit reached",
                errorType: ErrorType.OPENSKY_RATE_LIMIT,
                nextAvailable: await rateLimiter.getNextAvailableSlot()
            });
        }

        const { icao24 } = req.query;
        if (!icao24) {
            return res.status(400).json({ 
                error: "icao24 parameter is required",
                errorType: ErrorType.OPENSKY_INVALID_ICAO 
            });
        }

        const timeParam = Math.floor(Date.now() / 1000);
        const openSkyUrl = `${OPENSKY_CONSTANTS.API.BASE_URL}${OPENSKY_CONSTANTS.API.STATES_ENDPOINT}?time=${timeParam}&icao24=${Array.isArray(icao24) ? icao24.join(",") : icao24}`;
        
        console.log("[OpenSky Proxy] Making request");
        
        const response = await fetch(openSkyUrl, {
            headers: {
                ...openSkyAuth.getAuthHeaders(),
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            await errorHandler.handleOpenSkyError({
                response,
                message: `OpenSky API error: ${response.status}`
            }, rateLimiter);

            return res.status(response.status).json({
                error: userMessages[ErrorType.OPENSKY_SERVICE],
                errorType: ErrorType.OPENSKY_SERVICE
            });
        }

        const data = await response.json();
        rateLimiter.recordSuccess();

        return res.status(200).json(data);

    } catch (error) {
        console.error("[OpenSky Proxy] Error:", error);
        await errorHandler.handleOpenSkyError(error, rateLimiter);
        
        return res.status(500).json({
            error: "Failed to fetch data from OpenSky",
            errorType: ErrorType.OPENSKY_SERVICE,
            details: error instanceof Error ? error.message : String(error)
        });
    }
}