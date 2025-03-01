import type { NextApiRequest, NextApiResponse } from 'next';
import { TrackingDatabaseManager } from '@/lib/db/managers/trackingDatabaseManager';
import { OpenSkySyncService } from '@/lib/services/openSkySyncService';
import { APIErrors } from '@/lib/services/error-handler/api-error';
import type { Aircraft } from '@/types/base';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { action, aircraft, manufacturer } = req.body;

    console.log('[Tracking API] 📩 Received payload:', req.body);
    console.log(
      `[API] Received tracking request for manufacturer: "${manufacturer}"`
    );

    if (req.method === 'GET') {
      return getTrackedAircraft(res);
    }

    if (req.method !== 'POST') {
      throw APIErrors.BadRequest('Method not allowed');
    }

    if (!action) {
      throw APIErrors.BadRequest('Missing action in request');
    }

    console.log(`[Tracking API] Processing action: ${action}`);
    const openSkyService = OpenSkySyncService.getInstance();
    const trackingDb = TrackingDatabaseManager.getInstance();

    switch (action) {
      case 'getTrackedAircraft':
        return await fetchTrackedAircraft(manufacturer, res);

      case 'upsertActiveAircraftBatch':
        return await upsertAircraftBatch(aircraft, res);

      case 'syncManufacturer':
        return await syncAircraftForManufacturer(
          manufacturer,
          openSkyService,
          res
        );

      default:
        throw APIErrors.BadRequest(`Invalid action: ${action}`);
    }
  } catch (error) {
    console.error(`[Tracking API] ❌ Unhandled error:`, error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export default handler;

/**
 * Fetches tracked aircraft from the database.
 */
async function getTrackedAircraft(res: NextApiResponse) {
  const trackingDb = TrackingDatabaseManager.getInstance();
  const trackedAircraft = await trackingDb.getTrackedAircraft();
  return res.status(200).json({
    success: true,
    aircraft: trackedAircraft,
  });
}

/**
 * Fetches tracked aircraft for a specific manufacturer.
 */
async function fetchTrackedAircraft(
  manufacturer: string,
  res: NextApiResponse
) {
  console.log(
    `[Tracking API] 🔄 Fetching tracked aircraft for manufacturer: ${manufacturer}`
  );
  const trackingDb = TrackingDatabaseManager.getInstance();

  const trackedAircraft = await trackingDb.getTrackedAircraft(manufacturer);

  if (trackedAircraft.length > 0) {
    console.log(
      `[Tracking API] ✅ Found ${trackedAircraft.length} tracked aircraft in DB`
    );
    return res.status(200).json({
      success: true,
      aircraft: trackedAircraft,
    });
  }

  console.log(
    `[Tracking API] ❗ No tracked aircraft found in DB for ${manufacturer}`
  );
  return res.status(200).json({
    success: true,
    aircraft: [],
    message: `No aircraft found for manufacturer: ${manufacturer}`,
  });
}

/**
 * Upserts an aircraft batch into the tracking database.
 */
async function upsertAircraftBatch(aircraft: Aircraft[], res: NextApiResponse) {
  if (!Array.isArray(aircraft)) {
    throw APIErrors.BadRequest('Invalid aircraft data format');
  }

  console.log(`[Tracking API] 🛠️ Upserting ${aircraft.length} aircraft`);
  const trackingDb = TrackingDatabaseManager.getInstance();
  const count = await trackingDb.upsertActiveAircraftBatch(aircraft);

  console.log(`[Tracking API] ✅ Upserted ${count} aircraft`);
  return res.status(200).json({
    success: true,
    message: `Aircraft batch upserted successfully`,
    count,
  });
}

/**
 * Syncs aircraft for a specific manufacturer using OpenSky.
 */
async function syncAircraftForManufacturer(
  manufacturer: string,
  openSkyService: OpenSkySyncService,
  res: NextApiResponse
) {
  if (!manufacturer) {
    throw APIErrors.BadRequest('Manufacturer is required');
  }

  console.log(`[Tracking API] 🔄 Syncing manufacturer: ${manufacturer}`);
  const result = await openSkyService.syncManufacturer(manufacturer);

  return res.status(200).json({
    success: true,
    message: `Synced ${result.updated} aircraft for ${manufacturer}`,
    data: result,
  });
}
