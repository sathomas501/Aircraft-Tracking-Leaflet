// pages/api/proxy/opensky.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PollingRateLimiter } from '@/lib/services/rate-limiter';

// Initialize rate limiter with OpenSky's limits
const rateLimiter = new PollingRateLimiter({
    requestsPerMinute: 4,      // OpenSky's anonymous limit is 4 requests per minute
    requestsPerDay: 1000,      // Conservative daily limit
    maxWaitTime: 15000,        // Maximum 15s wait for a slot
    minPollingInterval: 15000, // Minimum 15s between requests
    maxPollingInterval: 30000, // Maximum 30s between requests
    batchSize: 100,           // Process in batches of 100 aircraft
    retryLimit: 3             // Maximum 3 retries
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
                // Service unavailable - we should increase the polling interval
                rateLimiter.increasePollingInterval();
                const waitTime = rateLimiter.getCurrentPollingInterval();
                console.log(`[OpenSky Proxy] 503 received, increasing polling interval to ${waitTime}ms`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }

            // If request was successful, we can try decreasing the interval
            rateLimiter.decreasePollingInterval();
            return response;

        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.error(`[OpenSky Proxy] Attempt ${attempt + 1} failed:`, error);
            
            // If it's not a 503, increase polling interval more aggressively
            rateLimiter.increasePollingInterval();
            rateLimiter.increasePollingInterval();
            
            const waitTime = rateLimiter.getCurrentPollingInterval();
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }

    throw lastError || new Error('Maximum retries exceeded');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { icao24List } = req.body;

    if (!icao24List) {
        return res.status(400).json({ error: 'icao24List is required' });
    }

    try {
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
        
        const auth = Buffer.from(
            `${process.env.OPENSKY_USERNAME}:${process.env.OPENSKY_PASSWORD}`
        ).toString('base64');

        console.log(`[OpenSky Proxy] Requesting data for ${icao24List.length} aircraft. Rate limits:`, {
            remainingMinute: rateLimiter.getRemainingRequests(),
            remainingDaily: rateLimiter.getRemainingDailyRequests(),
            currentInterval: rateLimiter.getCurrentPollingInterval()
        });

        const response = await fetchWithRetry(
            `https://opensky-network.org/api/states/all?icao24=${icao24String}`,
            {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Accept': 'application/json'
                }
            }
        );

        if (!response.ok) {
            throw new Error(`OpenSky API error: ${response.status}`);
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