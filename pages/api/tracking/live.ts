// pages/api/tracking/live.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import dbManager from '../../../lib/db/DatabaseManager';
import { Aircraft } from '@/types/base';
import openSkyProxyHandler from '../proxy/opensky';

// Cache for API responses
const TRACKING_CACHE = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 15000; // 15 seconds

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    ICAO24s,
    MANUFACTURER,
    includeStatic = false,
    activeOnly = false,
  } = req.body;

  console.log(
    `[API] Received request for ${ICAO24s?.length || 0} aircraft from ${MANUFACTURER || 'unknown MANUFACTURER'}`
  );
  console.log(`[API] Static data inclusion: ${includeStatic ? 'Yes' : 'No'}`);

  if (!ICAO24s || !Array.isArray(ICAO24s) || ICAO24s.length === 0) {
    console.log('[API] Invalid request: Missing or empty ICAO24s array');
    return res.status(400).json({
      error: 'Valid ICAO24s array required',
    });
  }

  // Show a sample of 5 ICAOs in the request
  const sampleIcaos = ICAO24s.slice(0, 5);
  console.log(
    `[API] Sample ICAOs in request: ${sampleIcaos.join(', ')}${ICAO24s.length > 5 ? '...' : ''}`
  );

  try {
    // Get live data using the proxy API
    const liveData = await fetchLiveAircraftData(ICAO24s);
    console.log(
      `[API] Received ${liveData.length} aircraft with position data`
    );

    // If static data is requested, fetch it from the database
    let staticAircraft: Record<string, any> = {};

    if (includeStatic && liveData.length > 0) {
      // Get ICAO24s that have position data
      const liveIcao24s = liveData.map((a) => a.ICAO24);

      console.log(
        `[API] Fetching static data for ${liveIcao24s.length} aircraft`
      );
      const staticData = await dbManager.getAircraftByIcao24s(liveIcao24s);
      console.log(
        `[API] Retrieved static data for ${staticData.length} aircraft`
      );

      const { batchIndex, totalBatches } = req.body;

      // Then modify your logging to include this information
      if (batchIndex && totalBatches) {
        console.log(
          `[API] Processing batch ${batchIndex}/${totalBatches} (${ICAO24s.length} ICAOs)`
        );
      } else {
        // Fall back to the existing logging
        console.log(`[API] Processing batch 1/1 (${ICAO24s.length} ICAOs)`);
      }

      // Create a lookup map for faster merging
      staticAircraft = staticData.reduce((map, aircraft) => {
        if (aircraft.ICAO24) {
          map[aircraft.ICAO24.toLowerCase()] = aircraft;
        }
        return map;
      }, {});
    }

    // Merge live and static data
    const mergedAircraft = liveData.map((liveAircraft) => {
      const icao = liveAircraft.ICAO24.toLowerCase();
      const staticData = staticAircraft[icao] || {};

      if (activeOnly) {
        // Only return aircraft with position data
       const mergedAircraft = /* your code that initializes this variable */;
const activeAircraft = mergedAircraft.filter((aircraft: AircraftWithTracking) => aircraft.latitude && aircraft.longitude);

        console.log(
          `[API] Filtering to ${activeAircraft.length} active aircraft out of ${mergedAircraft.length} total`
        );
      }

      return {
        ...staticData,
        ...liveAircraft,
        // Ensure consistent ICAO24 format
        ICAO24: icao,
        // Add tracking metadata
        _tracking: {
          MANUFACTURER,
          lastSeen: Date.now(),
        },
      };
    });

    console.log(
      `[API] Returning ${mergedAircraft.length} merged aircraft records`
    );

    return res.status(200).json({
      aircraft: mergedAircraft,
      count: mergedAircraft.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Error fetching tracking data:', error);

    // Return empty result to prevent frontend errors
    return res.status(500).json({
      error: 'Failed to fetch tracking data',
      message: error instanceof Error ? error.message : 'Unknown error',
      aircraft: [],
      count: 0,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Fetch live aircraft data using the OpenSky proxy
 * Handles batching and rate limits through the proxy
 */
async function fetchLiveAircraftData(ICAO24s: string[]): Promise<Aircraft[]> {
  // Generate a cache key based on ICAO24s
  const cacheKey = ICAO24s.sort().join(',');

  // Check cache first
  const cached = TRACKING_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(
      '[API] Using cached tracking data from',
      new Date(cached.timestamp).toLocaleTimeString()
    );
    return cached.data;
  }

  // Prepare batches (100 ICAOs per batch as per the proxy's limit)
  const BATCH_SIZE = 100;
  const batches: string[][] = [];

  for (let i = 0; i < ICAO24s.length; i += BATCH_SIZE) {
    batches.push(ICAO24s.slice(i, i + BATCH_SIZE));
  }

  console.log(
    `[API] Processing ${ICAO24s.length} ICAOs in ${batches.length} batches`
  );

  // Process batches sequentially to respect rate limits
  const results: Aircraft[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    try {
      console.log(
        `[API] Processing batch ${i + 1}/${batches.length} (${batch.length} ICAOs)`
      );

      // Sample of ICAOs in this batch
      const sampleIcaos = batch.slice(0, 5);
      console.log(
        `[API] Sample ICAOs in batch: ${sampleIcaos.join(', ')}${batch.length > 5 ? '...' : ''}`
      );

      // Call the proxy endpoint
      const batchResults = await fetchAircraftBatch(batch);

      // Add to overall results
      results.push(...batchResults);

      // Log results
      console.log(
        `[API] Batch ${i + 1} returned ${batchResults.length} aircraft with position data`
      );

      // Add a small delay between batches to be nice to the proxy
      if (i < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`[API] Error processing batch ${i + 1}:`, error);
      // Continue with the next batch instead of failing completely
    }
  }

  // Cache the combined results
  TRACKING_CACHE.set(cacheKey, {
    data: results,
    timestamp: Date.now(),
  });

  return results;
}

/**
 * Fetch a single batch of aircraft data using the proxy API
 */
async function fetchAircraftBatch(ICAO24Batch: string[]): Promise<Aircraft[]> {
  // Get base URL from environment variable or use a default
  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

  // Call our proxy API with absolute URL
  const response = await fetch(`${baseUrl}/api/proxy/opensky`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ICAO24s: ICAO24Batch }),
  });

  if (!response.ok) {
    // If we hit a rate limit, handle it gracefully
    if (response.status === 429) {
      const data = await response.json();
      const retryAfter = data.retryAfter || 60;
      console.log(`[API] Rate limited by proxy. Retry after ${retryAfter}s`);

      // If we're dealing with a rate limit, wait and retry once
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));

      // Retry the request
      const baseUrl =
        process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
      const retryResponse = await fetch(`${baseUrl}/api/proxy/opensky`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ICAO24s: ICAO24Batch }),
      });

      if (!retryResponse.ok) {
        console.error(
          `[API] Retry failed with status: ${retryResponse.status}`
        );
        return []; // Return empty array on retry failure
      }

      const retryData = await retryResponse.json();
      return processProxyResponse(retryData);
    }

    // For other errors, log and return empty array
    console.error(
      `[API] Proxy API error: ${response.status} ${response.statusText}`
    );
    return [];
  }

  const data = await response.json();
  return processProxyResponse(data);
}

/**
 * Process the response from the OpenSky proxy API
 */
function processProxyResponse(response: any): Aircraft[] {
  if (
    !response.success ||
    !response.data ||
    !Array.isArray(response.data.states)
  ) {
    console.warn('[API] Invalid response format from proxy:', response);
    return [];
  }

  // The proxy already formats the data, so we can use it directly
  return response.data.states.filter((state: any) => {
    // Ensure we only return aircraft with valid position data
    return (
      state &&
      typeof state.latitude === 'number' &&
      typeof state.longitude === 'number'
    );
  });
}
