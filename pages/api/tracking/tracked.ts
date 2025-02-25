// pages/api/tracking/tracked.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { TrackingDatabaseManager } from '@/lib/db/managers/trackingDatabaseManager';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { Aircraft } from '@/types/base';
import CacheManager from '@/lib/services/managers/cache-manager';

const staticDataCache = new CacheManager<Map<string, Aircraft>>(5 * 60);
const CACHE_KEY = 'static-aircraft-data';

interface StaticDataResponse {
  aircraft: Aircraft[];
}

async function fetchStaticData(
  icao24List: string[]
): Promise<Map<string, Aircraft>> {
  if (!icao24List || icao24List.length === 0) {
    return new Map<string, Aircraft>();
  }

  const cacheKey = `${CACHE_KEY}-${icao24List.sort().join(',')}`;
  const cachedData = await staticDataCache.get(cacheKey);

  if (cachedData) {
    console.log(
      `[TrackingAPI] Using cached static data for ${icao24List.length} aircraft`
    );
    return cachedData;
  }

  console.log(
    `[TrackingAPI] Fetching static data for ${icao24List.length} aircraft`
  );

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const response = await fetch(`${baseUrl}/api/aircraft/static-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ icao24s: icao24List }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch static data: ${response.statusText}`);
  }

  const result = (await response.json()) as StaticDataResponse;
  if (!Array.isArray(result.aircraft)) {
    throw new Error('Invalid response format from static-data API');
  }

  const staticDataMap = result.aircraft.reduce((map, aircraft) => {
    if (aircraft.icao24) {
      map.set(aircraft.icao24.toLowerCase(), aircraft);
    }
    return map;
  }, new Map<string, Aircraft>());

  await staticDataCache.set(cacheKey, staticDataMap);
  return staticDataMap;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const trackingDb = TrackingDatabaseManager.getInstance();
    const { manufacturer } = req.query;

    if (manufacturer && typeof manufacturer !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Manufacturer must be a string',
      });
    }

    const trackedAircraft = await trackingDb.getTrackedAircraft(
      typeof manufacturer === 'string' ? manufacturer : undefined
    );

    if (trackedAircraft.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        meta: {
          total: 0,
          timestamp: Date.now(),
        },
      });
    }

    const icao24List = trackedAircraft.map((aircraft) => aircraft.icao24);

    try {
      const staticDataMap = await fetchStaticData(icao24List);

      const mergedAircraft = trackedAircraft.map((aircraft) => {
        const staticInfo = staticDataMap.get(aircraft.icao24.toLowerCase());
        return {
          ...aircraft,
          ...(staticInfo && {
            model: staticInfo.model,
            manufacturer: staticInfo.manufacturer,
            TYPE_AIRCRAFT: staticInfo.TYPE_AIRCRAFT,
            'N-NUMBER': staticInfo['N-NUMBER'],
            NAME: staticInfo.NAME,
            CITY: staticInfo.CITY,
            STATE: staticInfo.STATE,
            OWNER_TYPE: staticInfo.OWNER_TYPE,
          }),
          isTracked: true,
          lastSeen: aircraft.last_contact * 1000,
        };
      });

      console.log(
        `[TrackingAPI] Merged ${mergedAircraft.length} aircraft with static data`
      );

      return res.status(200).json({
        success: true,
        data: mergedAircraft,
        meta: {
          total: mergedAircraft.length,
          timestamp: Date.now(),
        },
      });
    } catch (staticDataError) {
      console.error(
        '[TrackingAPI] Error fetching static data:',
        staticDataError
      );

      // Return basic aircraft data without enrichment
      return res.status(200).json({
        success: true,
        data: trackedAircraft.map((aircraft) => ({
          ...aircraft,
          isTracked: true,
          lastSeen: aircraft.last_contact * 1000,
        })),
        meta: {
          total: trackedAircraft.length,
          timestamp: Date.now(),
          enriched: false,
        },
      });
    }
  } catch (error) {
    console.error('[TrackingAPI] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

export default withErrorHandler(handler);
