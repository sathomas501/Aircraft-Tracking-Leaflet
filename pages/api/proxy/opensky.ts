// pages/api/proxy/opensky.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PollingRateLimiter } from '@/lib/services/rate-limiter';
import { openSkyAuth } from '@/lib/services/opensky-auth';
import { ErrorType } from '@/lib/services/error-handler/error-handler';
import { API_CONFIG } from '@/config/api';
import {
  OpenSkyTransforms,
  parsePositionData,
} from '@/utils/aircraft-transform1';
import { OpenSkyStateArray } from '@/types/base';

const rateLimiter = new PollingRateLimiter({
  requestsPerMinute: 100,
  requestsPerDay: 50000,
  maxBatchSize: API_CONFIG.PARAMS.MAX_ICAO_QUERY,
  minPollingInterval: API_CONFIG.API.MIN_POLLING_INTERVAL,
  maxPollingInterval: API_CONFIG.API.MAX_POLLING_INTERVAL,
  maxWaitTime: API_CONFIG.API.TIMEOUT_MS,
  retryLimit: API_CONFIG.API.DEFAULT_RETRY_LIMIT,
  requireAuthentication: true,
  interval: 60000, // Add appropriate interval value
  retryAfter: 1000, // Add appropriate retryAfter value
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed. Use POST or GET.',
      errorType: ErrorType.OPENSKY_SERVICE,
    });
  }

  // Get ICAO24s from either query params (GET) or body (POST)
  let icao24List: string[] = [];

  if (req.method === 'POST') {
    const { icao24s, action } = req.body;
    if (!Array.isArray(icao24s)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ICAO24 list format in request body',
        errorType: ErrorType.OPENSKY_REQUEST,
      });
    }
    icao24List = icao24s.filter((code) => /^[0-9a-f]{6}$/.test(code));
  } else {
    const { icao24 } = req.query;
    if (!icao24 || typeof icao24 !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid icao24 parameter',
        errorType: ErrorType.OPENSKY_REQUEST,
      });
    }
    icao24List = icao24.split(',').filter((code) => /^[0-9a-f]{6}$/.test(code));
  }

  if (icao24List.length > API_CONFIG.PARAMS.MAX_ICAO_QUERY) {
    return res.status(400).json({
      success: false,
      error: `Maximum ${API_CONFIG.PARAMS.MAX_ICAO_QUERY} ICAO24 codes per request.`,
      errorType: ErrorType.OPENSKY_REQUEST,
    });
  }

  try {
    if (!(await openSkyAuth.ensureAuthenticated())) {
      return res.status(401).json({
        success: false,
        error: 'Failed to authenticate with OpenSky',
        errorType: ErrorType.OPENSKY_AUTH,
      });
    }

    if (rateLimiter.isRateLimited()) {
      const nextSlot = await rateLimiter.getNextAvailableSlot();
      return res.status(429).json({
        success: false,
        error: 'Rate limit reached',
        errorType: ErrorType.OPENSKY_RATE_LIMIT,
        nextAvailable: nextSlot,
        retryAfter: Math.ceil((nextSlot.getTime() - Date.now()) / 1000),
      });
    }

    const openSkyUrl = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ALL_STATES}`;
    const params = new URLSearchParams({
      icao24: icao24List.join(','),
      extended: '1',
    });

    console.log('[OpenSky Proxy] Making request to OpenSky:', {
      url: `${openSkyUrl}?${params}`,
      icaoCount: icao24List.length,
      sample: icao24List.slice(0, 3),
    });

    let responseData: any;
    await rateLimiter.schedule(async () => {
      console.log(
        `[OpenSky Proxy] 🔄 Fetching states for ${icao24List.length} aircraft`
      );
      const response = await fetch(`${openSkyUrl}?${params}`, {
        headers: {
          ...openSkyAuth.getAuthHeaders(),
          Accept: API_CONFIG.HEADERS.ACCEPT,
        },
      });

      if (!response.ok) {
        throw new Error(`OpenSky API error: ${response.status}`);
      }

      responseData = await response.json();
      console.log(
        `[OpenSky Proxy] ✅ Received response with ${responseData.states?.length || 0} states`
      );
    });

    rateLimiter.recordSuccess();

    // Filter and transform states
    const states = (responseData.states || [])
      .filter(OpenSkyTransforms.validateState)
      .map((state: OpenSkyStateArray) =>
        OpenSkyTransforms.toTrackingData(state)
      );

    return res.status(200).json({
      success: true,
      data: {
        states,
        timestamp: responseData.time || Date.now(),
        meta: {
          total: states.length,
          requestedIcaos: icao24List.length,
        },
      },
    });
  } catch (error) {
    rateLimiter.recordFailure();
    console.error('[OpenSky Proxy] Error:', error);

    return res.status(503).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to fetch data from OpenSky',
      errorType: ErrorType.OPENSKY_SERVICE,
      retryAfter: Math.ceil(rateLimiter.getTimeUntilNextSlot() / 1000),
    });
  }
}
