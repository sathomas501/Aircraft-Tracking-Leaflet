// pages/api/tracking/live.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import dbManager from '../../../lib/db/DatabaseManager';
import { Aircraft } from '@/types/base';

// Cache for OpenSky API responses
const OPENSKY_CACHE = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 15000; // 15 seconds

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { icao24s, manufacturer, includeStatic = false } = req.body;

  if (!icao24s || !Array.isArray(icao24s) || icao24s.length === 0) {
    return res.status(400).json({
      error: 'Valid icao24s array required',
    });
  }

  try {
    // Get live data from OpenSky API
    const liveData = await fetchOpenSkyData(icao24s);

    // If static data is requested, fetch it from the database
    let staticAircraft: Record<string, any> = {};

    if (includeStatic) {
      // Get ICAO24s that have position data
      const liveIcao24s = liveData.map((a) => a.icao24);

      if (liveIcao24s.length > 0) {
        const staticData = await dbManager.getAircraftByIcao24s(liveIcao24s);

        // Create a lookup map for faster merging
        staticAircraft = staticData.reduce((map, aircraft) => {
          if (aircraft.icao24) {
            map[aircraft.icao24.toLowerCase()] = aircraft;
          }
          return map;
        }, {});
      }
    }

    // Merge live and static data
    const mergedAircraft = liveData.map((liveAircraft) => {
      const icao = liveAircraft.icao24.toLowerCase();
      const staticData = staticAircraft[icao] || {};

      return {
        ...staticData,
        ...liveAircraft,
        // Ensure consistent icao24 format
        icao24: icao,
        // Add tracking metadata
        _tracking: {
          manufacturer,
          lastSeen: Date.now(),
        },
      };
    });

    return res.status(200).json({
      aircraft: mergedAircraft,
      count: mergedAircraft.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Error fetching tracking data:', error);
    return res.status(500).json({
      error: 'Failed to fetch tracking data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Fetch data from OpenSky API with caching
 */
async function fetchOpenSkyData(icao24s: string[]): Promise<Aircraft[]> {
  // Generate a cache key based on ICAO24s
  const cacheKey = icao24s.sort().join(',');

  // Check cache first
  const cached = OPENSKY_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('[API] Using cached OpenSky data');
    return cached.data;
  }

  // Prepare batches of ICAO24s (OpenSky has limits)
  const batchSize = 100;
  const batches = [];

  for (let i = 0; i < icao24s.length; i += batchSize) {
    batches.push(icao24s.slice(i, i + batchSize));
  }

  console.log(`[API] Fetching OpenSky data in ${batches.length} batches`);

  try {
    // Process batches
    const results = await Promise.all(
      batches.map((batch) => fetchOpenSkyBatch(batch))
    );

    // Combine results
    const combinedResults = results.flat();

    // Cache the results
    OPENSKY_CACHE.set(cacheKey, {
      data: combinedResults,
      timestamp: Date.now(),
    });

    return combinedResults;
  } catch (error) {
    console.error('[API] Error fetching from OpenSky:', error);
    throw error;
  }
}

/**
 * Fetch a batch of ICAO24s from OpenSky
 */
async function fetchOpenSkyBatch(icao24Batch: string[]): Promise<Aircraft[]> {
  // Note: Replace with your actual OpenSky API endpoint and auth if needed
  const endpoint = 'https://opensky-network.org/api/states/all';

  // Create the querystring with ICAO24s
  const params = new URLSearchParams();
  params.append('icao24', icao24Batch.join(','));

  // Create an AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const response = await fetch(`${endpoint}?${params.toString()}`, {
    headers: {
      // Add any required auth headers here
    },
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`OpenSky API error: ${response.statusText}`);
  }

  const data = await response.json();

  // Process OpenSky API response format and convert to our Aircraft format
  return processOpenSkyResponse(data);
}

/**
 * Process OpenSky API response into Aircraft objects
 */
function processOpenSkyResponse(response: any): Aircraft[] {
  if (!response.states || !Array.isArray(response.states)) {
    return [];
  }

  return response.states
    .filter((state: any) => state && Array.isArray(state) && state.length >= 8)
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
        // ... other fields we might not need
      ] = state;

      // Only include aircraft with valid position data
      if (!latitude || !longitude) {
        return null;
      }

      return {
        icao24,
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
    })
    .filter(Boolean) as Aircraft[];
}
