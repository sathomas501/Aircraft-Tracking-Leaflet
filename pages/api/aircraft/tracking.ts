import type { NextApiRequest, NextApiResponse } from 'next';
import trackingDatabaseManager from '@/lib/db/trackingDatabaseManager';
import { Aircraft } from '@/types/base';
import fetch from 'node-fetch';
import CacheManager from '@/lib/services/managers/cache-manager';

// Initialize CacheManager with a 5-minute TTL
const icaoCache = new CacheManager<string[]>(5 * 60);

export interface TrackingUpdateRequest {
  action:
    | 'updatePositions'
    | 'getTrackedAircraft'
    | 'removeAircraft'
    | 'fetchAndStoreActiveAircraft'
    | 'upsertActiveAircraftBatch';
  manufacturer?: string;
  positions?: Aircraft[];
  icao24s?: string[];
  icao24?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log(
    `[Tracking API] 🔍 Received payload:`,
    JSON.stringify(req.body, null, 2)
  );

  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { action, positions } = req.body;
    if (!action || !positions) {
      console.warn('[Tracking API] ❌ Missing action or positions in request');
      return res
        .status(400)
        .json({ success: false, message: 'Invalid request format' });
    }

    console.log(`[Tracking API] 🚀 Processing action: ${action}`);

    if (action === 'upsertActiveAircraftBatch') {
      await trackingDatabaseManager.upsertLiveAircraftBatch(positions);
      return res
        .status(200)
        .json({ success: true, message: 'Aircraft batch upserted' });
    } else {
      return res
        .status(400)
        .json({ success: false, message: 'Unknown action' });
    }
  } catch (error) {
    console.error('[Tracking API] ❌ Internal Server Error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal server error' });
  }
}

async function fetchAndStoreActiveAircraft(manufacturer: string) {
  console.log(`[Tracking] 🔍 Checking ICAO cache for ${manufacturer}`);

  let icao24List: string[] = icaoCache.get(manufacturer) ?? [];

  if (icao24List.length === 0) {
    console.log(`[Tracking] 🔍 Fetching ICAOs from API for ${manufacturer}`);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/icao24s?manufacturer=${encodeURIComponent(manufacturer)}`
      );
      const data = (await response.json()) as {
        success: boolean;
        data: { icao24List: string[] };
      };

      if (!data.success || !data.data.icao24List.length) {
        console.warn(
          `[Tracking] ❌ No ICAOs found for manufacturer: ${manufacturer}`
        );
        return [];
      }

      icao24List = data.data.icao24List;
      icaoCache.set(manufacturer, icao24List);
    } catch (error) {
      console.error('[Tracking] ❌ Error fetching ICAOs:', error);
      return [];
    }
  }

  if (icao24List.length > 0) {
    const activeAircraft =
      await trackingDatabaseManager.getTrackedAircraftByICAOs(icao24List);
    return activeAircraft;
  } else {
    return [];
  }
}
