// pages/api/proxy/opensky.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PollingRateLimiter } from '@/lib/services/rate-limiter';
import { openSkyAuth } from '@/lib/services/opensky-auth';
import { ErrorType } from '@/lib/services/error-handler';

// Initialize rate limiter with OpenSky's limits
const rateLimiter = new PollingRateLimiter({
    requestsPerMinute: 60,     // Using authenticated limits
    requestsPerDay: 10000,     // Using authenticated limits
    maxWaitTime: 15000,
    minPollingInterval: 5000,  // More aggressive for authenticated
    maxPollingInterval: 30000,
    batchSize: 100,
    retryLimit: 3
});

async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < rateLimiter.retryLimit; attempt++) {
        try {
            // Wait for a rate limit slot
            const canProceed = await rateLimiter.tryAcquire(true);
            if (!canProceed) {
                throw new Error('Rate limit exceeded');
            }

            const response = await fetch(url, options);
            
            // Record the request
            rateLimiter.recordRequest();

            if (response.status === 503) {
                rateLimiter.increasePollingInterval();
                const waitTime = rateLimiter.getCurrentPollingInterval();
                console.log(`[OpenSky Proxy] 503 received, increasing polling interval to ${waitTime}ms`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }

            if (response.status === 401 || response.status === 403) {
                // Handle auth errors specifically
                await openSkyAuth.handleAuthError();
                throw new Error('Authentication failed, retrying with new credentials');
            }

            rateLimiter.decreasePollingInterval();
            return response;

        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.error(`[OpenSky Proxy] Attempt ${attempt + 1} failed:`, error);
            
            rateLimiter.increasePollingInterval();
            
            const waitTime = rateLimiter.getCurrentPollingInterval();
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }

    throw lastError || new Error('Maximum retries exceeded');
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { icao24List } = req.body;

    if (!icao24List) {
        return res.status(400).json({ error: 'icao24List is required' });
    }

    try {
        // Ensure we're authenticated before proceeding
        const isAuthenticated = await openSkyAuth.ensureAuthenticated();
        if (!isAuthenticated) {
            return res.status(401).json({ 
                error: 'Authentication failed',
                message: 'Could not authenticate with OpenSky Network'
            });
        }

        if (rateLimiter.isRateLimited()) {
            const nextSlot = await rateLimiter.getNextAvailableSlot();
            return res.status(429).json({ 
                error: 'Rate limit exceeded',
                nextAvailableSlot: nextSlot,
                remainingRequests: rateLimiter.getRemainingRequests(),
                remainingDaily: rateLimiter.getRemainingDailyRequests()
            });
        }

        const icao24String = Array.isArray(icao24List) ? icao24List.join(',') : icao24List;
        
        // Get authentication headers from the auth class
        const headers = {
            'Accept': 'application/json',
            ...openSkyAuth.getAuthHeaders()
        };

        console.log(`[OpenSky Proxy] Requesting data for ${icao24List.length} aircraft. Rate limits:`, {
            remainingMinute: rateLimiter.getRemainingRequests(),
            remainingDaily: rateLimiter.getRemainingDailyRequests(),
            currentInterval: rateLimiter.getCurrentPollingInterval()
        });

        const response = await fetchWithRetry(
            `https://opensky-network.org/api/states/all?icao24=${icao24String}`,
            { headers }
        );

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'No error text available');
            console.error('[OpenSky Proxy] Response error:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                errorText
            });
            throw new Error(`OpenSky API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        return res.status(200).json({
            data,
            meta: {
                remainingRequests: rateLimiter.getRemainingRequests(),
                remainingDaily: rateLimiter.getRemainingDailyRequests(),
                currentInterval: rateLimiter.getCurrentPollingInterval(),
                nextSlot: await rateLimiter.getNextAvailableSlot()
            }
        });
    } catch (error) {
        console.error('[OpenSky Proxy] Error:', error);
        return res.status(500).json({ 
            error: 'Failed to fetch from OpenSky',
            message: error instanceof Error ? error.message : 'Unknown error',
            meta: {
                remainingRequests: rateLimiter.getRemainingRequests(),
                remainingDaily: rateLimiter.getRemainingDailyRequests(),
                currentInterval: rateLimiter.getCurrentPollingInterval()
            }
        });
    }
}