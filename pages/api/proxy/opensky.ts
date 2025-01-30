// pages/api/proxy/opensky.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PollingRateLimiter } from '@/lib/services/rate-limiter';
import { openSkyAuth } from '@/lib/services/opensky-auth';
import { errorHandler, ErrorType } from '@/lib/services/error-handler';
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
    requestsPerDay:OPENSKY_CONSTANTS.AUTHENTICATED.REQUESTS_PER_DAY
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    console.log("[OpenSky Proxy] Received request:", req.method, req.url);

    if (req.method !== 'GET') {
        return res.status(405).json({ 
            error: "Method Not Allowed. Use GET.",
            errorType: ErrorType.OPENSKY_SERVICE 
        });
    }

    // Extract and validate ICAO24 codes
    const { icao24 } = req.query;

    if (!icao24) {
        errorHandler.handleError(
            ErrorType.OPENSKY_INVALID_ICAO,
            'Missing ICAO24 parameter'
        );
        return res.status(400).json({ 
            error: "icao24 parameter is required.",
            errorType: ErrorType.OPENSKY_INVALID_ICAO
        });
    }

    // Ensure icao24List is properly formatted
    const icao24List: string[] = Array.isArray(icao24) ? icao24 : [icao24];

    // Check batch size limits
    if (icao24List.length > OPENSKY_CONSTANTS.AUTHENTICATED.MAX_BATCH_SIZE) {
        errorHandler.handleError(
            ErrorType.OPENSKY_INVALID_ICAO,
            'Too many ICAO24 codes in single request',
            { 
                provided: icao24List.length, 
                maximum: OPENSKY_CONSTANTS.AUTHENTICATED.MAX_BATCH_SIZE 
            }
        );
        return res.status(400).json({
            error: `Maximum of ${OPENSKY_CONSTANTS.AUTHENTICATED.MAX_BATCH_SIZE} ICAO24 codes per request.`,
            errorType: ErrorType.OPENSKY_INVALID_ICAO
        });
    }

    try {
        await openSkyAuth.ensureAuthenticated();

        if (rateLimiter.isRateLimited()) {
            const nextSlot = await rateLimiter.getNextAvailableSlot();
            errorHandler.handleError(
                ErrorType.OPENSKY_RATE_LIMIT,
                'Rate limit reached',
                { nextAvailable: nextSlot }
            );
            return res.status(429).json({
                error: "Rate limit reached. Please try again later.",
                errorType: ErrorType.OPENSKY_RATE_LIMIT,
                nextAvailable: nextSlot
            });
        }
        
        // After successful request:
        rateLimiter.recordRequest();

        const timeParam = Math.floor(Date.now() / 1000);
        const proxyUrl = `${OPENSKY_CONSTANTS.API.BASE_URL}${OPENSKY_CONSTANTS.API.STATES_ENDPOINT}?time=${timeParam}&icao24=${icao24List.join(",")}`;

        const response = await fetch(proxyUrl, {
            headers: {
                ...openSkyAuth.getAuthHeaders(),
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`OpenSky API error: ${response.status}`);
        }

        const data = await response.json();
        rateLimiter.recordRequest(); // Record successful request
        return res.status(200).json(data);

    } catch (error) {
        handleProxyError(error, res);
    }
}

function handleProxyError(error: unknown, res: NextApiResponse): void {
    console.error("[OpenSky Proxy] Error:", error);
    rateLimiter.increasePollingInterval();  // Increase interval on errors

    if (error instanceof Error) {
        if (error.message.includes('authentication')) {
            return res.status(401).json({
                error: "OpenSky authentication failed.",
                errorType: ErrorType.OPENSKY_AUTH
            });
        }
        if (error.message.includes('rate limit')) {
            return res.status(429).json({
                error: "OpenSky rate limit exceeded.",
                errorType: ErrorType.OPENSKY_RATE_LIMIT
            });
        }
    }

    return res.status(500).json({
        error: "Failed to fetch data from OpenSky.",
        errorType: ErrorType.OPENSKY_SERVICE,
        details: error instanceof Error ? error.message : String(error)
    });
}