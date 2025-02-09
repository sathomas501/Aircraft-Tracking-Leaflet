// pages/api/opensky.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PollingRateLimiter } from '@/lib/services/rate-limiter';
import { openSkyAuth } from '@/lib/services/opensky-auth';
import { errorHandler, ErrorType } from '@/lib/services/error-handler';
import { API_CONFIG } from '@/config/api';

const rateLimiter = new PollingRateLimiter({
  requestsPerMinute: 100,
  requestsPerDay: 50000,
  maxBatchSize: API_CONFIG.PARAMS.MAX_ICAO_QUERY,
  minPollingInterval: API_CONFIG.API.MIN_POLLING_INTERVAL,
  maxPollingInterval: API_CONFIG.API.MAX_POLLING_INTERVAL,
  maxWaitTime: API_CONFIG.API.TIMEOUT_MS,
  retryLimit: API_CONFIG.API.DEFAULT_RETRY_LIMIT,
  requireAuthentication: true,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method Not Allowed. Use POST.',
      errorType: ErrorType.OPENSKY_SERVICE,
    });
  }

  const { icao24s } = req.body;

  if (
    !icao24s ||
    !Array.isArray(icao24s) ||
    icao24s.length > API_CONFIG.PARAMS.MAX_ICAO_QUERY
  ) {
    return res.status(400).json({
      error: `Invalid ICAO24 list. Maximum ${API_CONFIG.PARAMS.MAX_ICAO_QUERY} codes per request.`,
      errorType: ErrorType.OPENSKY_REQUEST,
    });
  }

  try {
    if (!(await openSkyAuth.ensureAuthenticated())) {
      return res.status(401).json({
        error: 'Failed to authenticate with OpenSky',
        errorType: ErrorType.OPENSKY_AUTH,
      });
    }

    if (rateLimiter.isRateLimited()) {
      const nextSlot = await rateLimiter.getNextAvailableSlot();
      return res.status(429).json({
        error: 'Rate limit reached',
        errorType: ErrorType.OPENSKY_RATE_LIMIT,
        nextAvailable: nextSlot,
        retryAfter: Math.ceil((nextSlot.getTime() - Date.now()) / 1000),
      });
    }

    if (!icao24s.length) {
      return res.status(200).json({ states: [] });
    }

    const formattedIcaos = icao24s
      .map((code: string) => code.toLowerCase().trim())
      .filter((code: string) => /^[0-9a-f]{6}$/.test(code));

    if (formattedIcaos.length === 0) {
      return res.status(400).json({
        error: 'No valid ICAO24s provided',
        errorType: ErrorType.OPENSKY_REQUEST,
      });
    }

    const openSkyUrl = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ALL_STATES}?icao24=${formattedIcaos.join(',')}`;

    let responseData: any;
    await rateLimiter.schedule(async () => {
      const response = await fetch(openSkyUrl, {
        headers: {
          ...openSkyAuth.getAuthHeaders(),
          Accept: API_CONFIG.HEADERS.ACCEPT,
        },
      });

      if (!response.ok) {
        throw new Error(`OpenSky API error: ${response.status}`);
      }

      responseData = await response.json();
    });

    rateLimiter.recordSuccess();
    return res.status(200).json({ states: responseData.states || [] });
  } catch (error) {
    rateLimiter.recordFailure();
    console.error('[OpenSky Proxy] Error:', error);
    return res.status(503).json({
      error:
        error instanceof Error
          ? error.message
          : 'Failed to fetch data from OpenSky',
      errorType: ErrorType.OPENSKY_SERVICE,
      retryAfter: Math.ceil(rateLimiter.getTimeUntilNextSlot() / 1000),
    });
  }
}
