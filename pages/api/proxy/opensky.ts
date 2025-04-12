// pages/api/proxy/opensky.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { API_CONFIG } from '@/config/api';

// Constants
const MAX_ICAOS_PER_REQUEST = 100; // OpenSky limit
const CACHE_TTL = 60000; // 1 minute cache
const MAX_REQUESTS_PER_MIN = 15; // Rate limit
const MAX_REQUESTS_PER_DAY = 1000; // Daily limit

// Rate limiting state
let requestsThisMinute = 0;
let requestsToday = 0;
let lastMinuteReset = Date.now();
let lastDayReset = Date.now();

// Cache for recent requests
const responseCache = new Map<string, { timestamp: number; data: any }>();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  // Extract ICAO24 codes from request
  const { icao24s } = req.body;

  if (!Array.isArray(icao24s) || icao24s.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid or missing icao24s array',
    });
  }

  // Validate ICAO codes (6 hex characters)
  const validIcaos = icao24s
    .filter((code) => typeof code === 'string')
    .map((code) => code.trim().toLowerCase())
    .filter((code) => /^[0-9a-f]{6}$/.test(code));

  // Limit batch size
  if (validIcaos.length > MAX_ICAOS_PER_REQUEST) {
    return res.status(400).json({
      success: false,
      error: `Maximum ${MAX_ICAOS_PER_REQUEST} ICAO24 codes per request`,
    });
  }

  // Check cache for identical request
  const requestKey = JSON.stringify(validIcaos.sort());
  const cachedResponse = responseCache.get(requestKey);

  if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_TTL) {
    console.log('[OpenSky Proxy] Returning cached response');
    return res.status(200).json(cachedResponse.data);
  }

  // Reset rate limits if needed
  checkAndResetRateLimits();

  // Check rate limits
  if (requestsThisMinute >= MAX_REQUESTS_PER_MIN) {
    console.log('[OpenSky Proxy] Rate limit reached (per minute)');
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil((lastMinuteReset + 60000 - Date.now()) / 1000),
    });
  }

  if (requestsToday >= MAX_REQUESTS_PER_DAY) {
    console.log('[OpenSky Proxy] Rate limit reached (per day)');
    return res.status(429).json({
      success: false,
      error: 'Daily limit exceeded',
      retryAfter: Math.ceil((lastDayReset + 86400000 - Date.now()) / 1000),
    });
  }

  try {
    // Build OpenSky API URL
    const OPENSKY_API_URL =
      process.env.OPENSKY_API_URL || 'https://opensky-network.org/api';
    const endpoint = `${OPENSKY_API_URL}/states/all`;

    // Build query parameters
    const params = new URLSearchParams({
      icao24: validIcaos.join(','),
      extended: '1',
    });

    console.log(
      `[OpenSky Proxy] Fetching ${validIcaos.length} aircraft from OpenSky API`
    );

    // Update rate limit counters
    requestsThisMinute++;
    requestsToday++;

    // Add authentication if provided
    const authHeaders: HeadersInit = {};
    if (process.env.OPENSKY_USERNAME && process.env.OPENSKY_PASSWORD) {
      const authString = Buffer.from(
        `${process.env.OPENSKY_USERNAME}:${process.env.OPENSKY_PASSWORD}`
      ).toString('base64');
      authHeaders['Authorization'] = `Basic ${authString}`;
    }

    // Make request to OpenSky API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      API_CONFIG.TIMEOUT?.DEFAULT || 20000
    );

    const response = await fetch(`${endpoint}?${params}`, {
      headers: {
        ...authHeaders,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(
        `OpenSky API error: ${response.status} ${response.statusText}`
      );
    }

    // Parse the response
    const data = await response.json();

    // Extract and format aircraft states
    let states = [];
    if (data?.states && Array.isArray(data.states)) {
      states = data.states
        .filter(
          (state: any[]) =>
            Array.isArray(state) && state.length >= 8 && state[5] && state[6]
        )
        .map((state: any[]) => {
          // OpenSky API returns an array with specific indexes
          const [
            icao24,
            callsign,
            origin_country,
            time_position,
            last_contact,
            longitude,
            latitude,
            altitude,
            on_ground,
            velocity,
            heading,
            vertical_rate,
            // ... other fields
          ] = state;

          return {
            icao24: icao24?.toLowerCase(),
            callsign: callsign?.trim(),
            origin_country,
            last_contact,
            longitude,
            latitude,
            altitude: altitude || 0,
            on_ground: !!on_ground,
            velocity: velocity || 0,
            heading: heading || 0,
            vertical_rate: vertical_rate || 0,
          };
        });
    }

    // Prepare response
    const responseData = {
      success: true,
      data: {
        states,
        timestamp: data.time || Date.now(),
        meta: {
          total: states.length,
          requested: validIcaos.length,
        },
      },
    };

    // Cache the response
    responseCache.set(requestKey, {
      timestamp: Date.now(),
      data: responseData,
    });

    console.log(`[OpenSky Proxy] Returning ${states.length} aircraft states`);
    return res.status(200).json(responseData);
  } catch (error) {
    console.error('[OpenSky Proxy] Error:', error);

    return res
      .status(
        error instanceof Error && error.name === 'AbortError'
          ? 408 // Request Timeout
          : 503 // Service Unavailable
      )
      .json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch data from OpenSky',
        retryAfter: 60,
      });
  }
}

/**
 * Check and reset rate limit counters if needed
 */
function checkAndResetRateLimits() {
  const now = Date.now();

  // Reset minute counter after 60 seconds
  if (now - lastMinuteReset > 60000) {
    requestsThisMinute = 0;
    lastMinuteReset = now;
    console.log('[OpenSky Proxy] Reset minute rate limit counter');
  }

  // Reset daily counter after 24 hours
  if (now - lastDayReset > 86400000) {
    requestsToday = 0;
    lastDayReset = now;
    console.log('[OpenSky Proxy] Reset daily rate limit counter');
  }
}
