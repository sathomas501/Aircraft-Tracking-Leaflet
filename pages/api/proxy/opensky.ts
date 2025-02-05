// pages/api/proxy/opensky.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PollingRateLimiter } from '@/lib/services/rate-limiter';
import { openSkyAuth } from '@/lib/services/opensky-auth';
import { errorHandler, ErrorType } from '@/lib/services/error-handler';
import { OPENSKY_CONSTANTS } from '../../../constants/opensky';
import { API_CONFIG } from '@/config/api';

// Initialize rate limiter with OpenSky's authenticated limits
const rateLimiter = new PollingRateLimiter({
    requireAuthentication: true,
    minPollingInterval: API_CONFIG.API.MIN_POLLING_INTERVAL,
    maxPollingInterval: API_CONFIG.API.MAX_POLLING_INTERVAL,
    maxWaitTime: API_CONFIG.API.TIMEOUT_MS,
    maxBatchSize: OPENSKY_CONSTANTS.RATE_LIMITS.AUTHENTICATED.MAX_BATCH_SIZE,
    retryLimit: API_CONFIG.API.DEFAULT_RETRY_LIMIT,
    requestsPerMinute: OPENSKY_CONSTANTS.RATE_LIMITS.AUTHENTICATED.REQUESTS_PER_10_MIN,
    requestsPerDay: OPENSKY_CONSTANTS.RATE_LIMITS.AUTHENTICATED.REQUESTS_PER_DAY
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    console.log("[OpenSky Proxy] Starting request handling");

    // Basic request validation
    if (req.method !== 'GET') {
        return res.status(405).json({ 
            error: "Method Not Allowed. Use GET.",
            errorType: ErrorType.OPENSKY_SERVICE 
        });
    }

    // First, try to authenticate
    try {
        console.log("[OpenSky Proxy] Starting authentication...");
        const authResult = await openSkyAuth.ensureAuthenticated();
        
        if (!authResult) {
            console.error("[OpenSky Proxy] Authentication failed");
            return res.status(401).json({
                error: "Failed to authenticate with OpenSky",
                errorType: ErrorType.OPENSKY_AUTH
            });
        }
        
        console.log("[OpenSky Proxy] Authentication successful");

        // Now handle the ICAO validation
        const { icao24 } = req.query;
        if (!icao24) {
            return res.status(400).json({ 
                error: "icao24 parameter is required.",
                errorType: ErrorType.OPENSKY_INVALID_ICAO
            });
        }

        const icao24List: string[] = Array.isArray(icao24) ? icao24 : [icao24];
        if (icao24List.length > OPENSKY_CONSTANTS.RATE_LIMITS.AUTHENTICATED.MAX_BATCH_SIZE) {
            return res.status(400).json({
                error: `Maximum of ${OPENSKY_CONSTANTS.RATE_LIMITS.AUTHENTICATED.MAX_BATCH_SIZE} ICAO24 codes per request.`,
                errorType: ErrorType.OPENSKY_INVALID_ICAO
            });
        }

        // Check rate limits
        if (rateLimiter.isRateLimited()) {
            const nextSlot = await rateLimiter.getNextAvailableSlot();
            return res.status(429).json({
                error: "Rate limit reached",
                errorType: ErrorType.OPENSKY_RATE_LIMIT,
                nextAvailable: nextSlot
            });
        }

        // Make the authenticated request
        const timeParam = Math.floor(Date.now() / 1000);
        const openSkyUrl = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ALL_STATES}?time=${timeParam}&icao24=${icao24List.join(",")}`;
        
        console.log("[OpenSky Proxy] Making request with auth headers");
        const authHeaders = openSkyAuth.getAuthHeaders();
        console.log("[OpenSky Proxy] Auth header present:", !!authHeaders.Authorization);

        const response = await fetch(openSkyUrl, {
            headers: {
                ...authHeaders,
                'Accept': 'application/json'
            }
        });

        console.log("[OpenSky Proxy] OpenSky response status:", response.status);

        if (!response.ok) {
            throw new Error(`OpenSky API error: ${response.status}`);
        }

        const data = await response.json();
        rateLimiter.recordRequest();
        return res.status(200).json(data);

    } catch (error) {
        console.error("[OpenSky Proxy] Error:", error);
        
        if (error instanceof Error) {
            if (error.message.includes('authentication')) {
                return res.status(401).json({
                    error: "OpenSky authentication failed",
                    errorType: ErrorType.OPENSKY_AUTH
                });
            }
        }
        
        return res.status(500).json({
            error: "Failed to fetch data from OpenSky",
            errorType: ErrorType.OPENSKY_SERVICE,
            details: error instanceof Error ? error.message : String(error)
        });
    }
}