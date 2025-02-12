import type { NextApiRequest, NextApiResponse } from 'next';
import trackingDatabaseManager from '../../../lib/db/trackingDatabaseManager';
import { Aircraft } from '@/types/base';

export interface TrackingUpdateRequest {
  action:
    | 'updatePositions'
    | 'getTrackedAircraft'
    | 'removeAircraft'
    | 'upsertActiveAircraftBatch'; // Add 'upsertActiveAircraftBatch'
  positions?: Aircraft[];
  icao24s?: string[];
  icao24?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log(
    `🚀 [Tracking API] Request Received - Method: ${req.method}, Path: ${req.url}`
  );
  console.log(`[Tracking API] 🛠️ Request Headers:`, req.headers);
  console.log(
    `[Tracking API] 🛠️ Raw request body:`,
    JSON.stringify(req.body, null, 2)
  );

  const startTime = Date.now(); // Capture request start time for performance tracking

  if (req.method !== 'POST') {
    console.warn(`[Tracking API] ❌ Method Not Allowed: ${req.method}`);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const request = req.body as TrackingUpdateRequest;

    if (!request || !request.action) {
      console.error(
        `[Tracking API] ❌ Missing action in request body:`,
        req.body
      );
      return res.status(400).json({ error: 'Missing action in request body' });
    }

    console.log(`[Tracking API] ✅ Processing action: ${request.action}`);

    switch (request.action) {
      case 'updatePositions':
        if (!request.positions || !Array.isArray(request.positions)) {
          console.error(
            `[Tracking API] ❌ Invalid positions data:`,
            request.positions
          );
          return res.status(400).json({ error: 'Invalid positions data' });
        }
        await updatePositions(request.positions);
        console.log(
          `[Tracking API] 🔄 Updated positions for ${request.positions.length} aircraft.`
        );
        break;

      case 'getTrackedAircraft':
        if (!request.icao24s || !Array.isArray(request.icao24s)) {
          console.error(
            `[Tracking API] ❌ Invalid ICAO24 list:`,
            request.icao24s
          );
          return res.status(400).json({ error: 'Invalid ICAO24 list' });
        }
        const aircraft = await getTrackedAircraft(request.icao24s);
        console.log(
          `[Tracking API] 📡 Retrieved ${aircraft.length} tracked aircraft.`
        );
        return res.status(200).json({ success: true, aircraft });

      case 'upsertActiveAircraftBatch':
        if (!request.positions || !Array.isArray(request.positions)) {
          console.error(
            `[Tracking API] ❌ Invalid positions data:`,
            request.positions
          );
          return res.status(400).json({ error: 'Invalid positions data' });
        }
        await trackingDatabaseManager.upsertLiveAircraftBatch(
          request.positions
        );
        console.log(
          `[Tracking API] 🔄 Upserted ${request.positions.length} aircraft.`
        );
        break;

      case 'removeAircraft':
        if (!request.icao24) {
          console.error(`[Tracking API] ❌ Invalid ICAO24:`, request.icao24);
          return res.status(400).json({ error: 'Invalid ICAO24' });
        }
        await removeTrackedAircraft(request.icao24);
        console.log(
          `[Tracking API] 🗑️ Removed aircraft with ICAO24: ${request.icao24}`
        );
        break;

      default:
        console.error(`[Tracking API] ❌ Unknown action: ${request.action}`);
        return res.status(400).json({ error: 'Invalid action' });
    }

    const executionTime = Date.now() - startTime;
    console.log(`[Tracking API] ✅ Request completed in ${executionTime}ms`);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Tracking API] ❌ Internal Server Error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : error,
    });
  }
}
/**
 * Updates the position of a tracked aircraft.
 */
async function updatePositions(positions: Aircraft[]) {
  console.log(`[Tracking] Updating positions for ${positions.length} aircraft`);
  try {
    for (const position of positions) {
      await trackingDatabaseManager.updateAircraftPosition(
        position.icao24,
        position.latitude,
        position.longitude,
        position.heading
      );
    }
  } catch (error) {
    console.error('[Tracking] Error updating positions:', error);
    throw error;
  }
}

async function getTrackedAircraft(icao24s: string[]) {
  return await trackingDatabaseManager.getTrackedAircraftByICAOs(icao24s);
}

/**
 * Removes an aircraft from the tracking database.
 */
export async function removeTrackedAircraft(icao24: string) {
  console.log(`[Tracking] Removing tracked aircraft with ICAO24: ${icao24}`);
  try {
    await trackingDatabaseManager.deleteAircraft(icao24);
    console.log(
      `[Tracking] Successfully removed aircraft with ICAO24: ${icao24}`
    );
  } catch (error) {
    console.error(
      `[Tracking] Error removing aircraft with ICAO24: ${icao24}`,
      error
    );
    throw error;
  }
}

/**
 * Clears all tracking data from the database.
 */
export async function resetTrackingData() {
  console.log('[Tracking] Clearing all tracked aircraft data...');
  try {
    await trackingDatabaseManager.clearTrackingData();
    console.log('[Tracking] Successfully cleared tracking data.');
  } catch (error) {
    console.error('[Tracking] Error clearing tracking data:', error);
    throw error;
  }
}
