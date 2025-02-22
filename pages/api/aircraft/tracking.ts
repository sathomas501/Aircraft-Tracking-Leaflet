// pages/api/aircraft/tracking.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Aircraft } from '@/types/base';
import trackingDatabaseManager from '@/lib/db/managers/trackingDatabaseManager';
import { APIErrors } from '@/lib/services/error-handler/api-error';
import { withErrorHandler } from '@/lib/middleware/error-handler';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[Tracking API] 📩 Received payload:', req.body);

  if (req.method === 'GET') {
    // Get tracked aircraft from last 2 hours
    const trackedAircraft = await trackingDatabaseManager.getTrackedAircraft();
    return res.status(200).json({
      success: true,
      aircraft: trackedAircraft,
    });
  }

  if (req.method !== 'POST') {
    throw APIErrors.BadRequest('Method not allowed');
  }

  const { action, aircraft, manufacturer } = req.body;

  if (!action) {
    throw APIErrors.BadRequest('Missing action in request');
  }

  console.log(`[Tracking API] Processing action: ${action}`);

  try {
    switch (action) {
      case 'getTrackedAircraft': {
        const trackedAircraft =
          await trackingDatabaseManager.getTrackedAircraft(manufacturer);
        return res.status(200).json({
          success: true,
          aircraft: trackedAircraft,
        });
      }

      case 'upsertActiveAircraftBatch': {
        if (!Array.isArray(aircraft)) {
          throw APIErrors.BadRequest('Invalid aircraft data format');
        }

        console.log(`[Tracking API] 🛠️ Upserting ${aircraft.length} aircraft`);

        const count =
          await trackingDatabaseManager.upsertActiveAircraftBatch(aircraft);
        console.log(`[Tracking API] ✅ Upserted ${count} aircraft`);

        return res.status(200).json({
          success: true,
          message: `Aircraft batch upserted successfully`,
          count,
        });
      }

      default:
        throw APIErrors.BadRequest(`Invalid action: ${action}`);
    }
  } catch (error) {
    console.error(`[Tracking API] ❌ Error:`, error);
    throw error;
  }
}

export default withErrorHandler(handler);
