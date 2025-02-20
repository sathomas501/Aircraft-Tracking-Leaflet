// pages/api/tracking/tracked.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { TrackingDatabaseManager } from '@/lib/db/managers/trackingDatabaseManager';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { Aircraft } from '@/types/base';
import CacheManager from '@/lib/services/managers/cache-manager';

const staticDataCache = new CacheManager<Map<string, Aircraft>>(5 * 60);
const CACHE_KEY = 'static-aircraft-data';

async function fetchStaticData(
  icao24List: string[]
): Promise<Map<string, Aircraft>> {
  const cacheKey = `${CACHE_KEY}-${icao24List.sort().join(',')}`;

  const cachedData = await staticDataCache.get(cacheKey);
  if (cachedData) {
    console.log(
      `[Tracked API] 📦 Using cached static data for ${icao24List.length} aircraft`
    );
    return cachedData;
  }

  console.log(
    `[Tracked API] 📡 Fetching static data for ${icao24List.length} aircraft`
  );

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const staticDataResponse = await fetch(
    `${baseUrl}/api/aircraft/static-data`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ icao24s: icao24List }),
    }
  );

  if (!staticDataResponse.ok) {
    throw new Error(
      `Failed to fetch static data: ${staticDataResponse.statusText}`
    );
  }

  const staticDataResult = await staticDataResponse.json();

  if (!Array.isArray(staticDataResult.aircraft)) {
    throw new Error('Invalid response format from static-data API');
  }

  const staticDataMap: Map<string, Aircraft> = new Map(
    staticDataResult.aircraft.map((data: Aircraft): [string, Aircraft] => [
      data.icao24.toLowerCase(),
      data,
    ])
  );

  await staticDataCache.set(cacheKey, staticDataMap);

  return staticDataMap;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const trackingDb = TrackingDatabaseManager.getInstance();
  await trackingDb.initializeDatabase();

  const staleThreshold = Math.floor(Date.now() / 1000) - 2 * 60 * 60; // 2 hours

  const trackedAircraft = await trackingDb.executeQuery<Aircraft>(
    'SELECT * FROM tracked_aircraft WHERE last_contact > ? ORDER BY last_contact DESC',
    [staleThreshold]
  );

  if (trackedAircraft.length === 0) {
    return res.status(200).json({
      success: true,
      data: [],
      meta: {
        total: 0,
        staleThreshold,
        timestamp: Date.now(),
      },
    });
  }

  const icao24List = trackedAircraft.map((aircraft) => aircraft.icao24);
  const staticDataMap = await fetchStaticData(icao24List);

  const mergedAircraft = trackedAircraft.map((aircraft: Aircraft) => {
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
    `[Tracked API] ✅ Merged ${mergedAircraft.length} aircraft with static data`
  );

  const cacheKey = `${CACHE_KEY}-${icao24List.sort().join(',')}`;
  const isCached = Boolean(await staticDataCache.get(cacheKey));

  return res.status(200).json({
    success: true,
    data: mergedAircraft,
    meta: {
      total: mergedAircraft.length,
      staleThreshold,
      fromCache: isCached,
      timestamp: Date.now(),
    },
  });
}

export default withErrorHandler(handler);
