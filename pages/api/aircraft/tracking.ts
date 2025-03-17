import type { NextApiRequest, NextApiResponse } from 'next';
import { TrackingDatabaseManager } from '@/lib/db/managers/trackingDatabaseManager';
import { OpenSkySyncService } from '@/lib/services/openSkySyncService';
import { APIErrors } from '@/lib/services/error-handler/api-error';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { action, aircraft, manufacturer } = req.body;

    console.log('[Tracking API] 📩 Received payload:', req.body);
    console.log(
      `[API] Received tracking request for manufacturer: "${manufacturer}"`
    );

    if (req.method === 'GET') {
      // ✅ Fix: Replace getTrackedAircraft with fetchTrackedAircraft
      const trackingDb = await TrackingDatabaseManager.getInstance();
      return await fetchTrackedAircraft(trackingDb, manufacturer, res);
    }

    if (req.method !== 'POST') {
      throw APIErrors.BadRequest('Method not allowed');
    }

    if (!action) {
      throw APIErrors.BadRequest('Missing action in request');
    }

    console.log(`[Tracking API] Processing action: ${action}`);
    const openSkyService = OpenSkySyncService.getInstance();

    // ✅ Ensure database instance is awaited
    const trackingDb = await TrackingDatabaseManager.getInstance();

    switch (action) {
      case 'getTrackedAircraft':
        return await fetchTrackedAircraft(trackingDb, manufacturer, res);

      default:
        throw APIErrors.BadRequest(`Invalid action: ${action}`);
    }
  } catch (error) {
    console.error(`[Tracking API] ❌ Unhandled error:`, error);
    return res
      .status(500)
      .json({ success: false, error: 'Internal Server Error' });
  }
}

async function fetchTrackedAircraft(
  trackingDb: TrackingDatabaseManager,
  manufacturer: string,
  res: NextApiResponse
) {
  try {
    console.log(
      `[Tracking API] Fetching tracked aircraft for: ${manufacturer}`
    );

    // ✅ Ensure proper method call with an awaited instance
    const trackedAircraft = await trackingDb.getTrackedAircraft(manufacturer);

    return res.status(200).json({
      success: true,
      data: trackedAircraft,
    });
  } catch (error) {
    console.error(`[Tracking API] Error fetching tracked aircraft:`, error);
    return res.status(500).json({
      success: false,
      error: 'Error fetching tracked aircraft',
    });
  }
}

export default handler;
