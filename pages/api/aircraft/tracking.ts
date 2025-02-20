// pages/api/aircraft/tracking.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Aircraft } from '@/types/base';
import trackingDatabaseManager from '@/lib/db/managers/trackingDatabaseManager';
import { APIErrors } from '@/lib/services/error-handler/api-error';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[Tracking API] 📩 Received payload:', req.body);

  try {
    if (req.method === 'GET') {
      const trackedAircraft =
        await trackingDatabaseManager.getRecentTrackedAircraft(2); // 2-hour window
      return res.status(200).json({ success: true, aircraft: trackedAircraft });
    }

    if (req.method !== 'POST') {
      throw APIErrors.BadRequest('Method not allowed');
    }

    const { action, aircraft } = req.body;
    if (!action) {
      throw APIErrors.BadRequest('Missing action in request');
    }

    console.log(`[Tracking API] Processing action: ${action}`);

    switch (action) {
      case 'upsertActiveAircraftBatch': {
        if (!aircraft || !Array.isArray(aircraft)) {
          throw APIErrors.BadRequest('Invalid aircraft data format');
        }

        console.log(`[Tracking API] 🛠️ Upserting ${aircraft.length} aircraft`);

        try {
          const count = await trackingDatabaseManager.upsertActiveAircraftBatch(
            [aircraft]
          );
          console.log(`[Tracking API] ✅ Upserted ${count} aircraft`);

          return res.status(200).json({
            success: true,
            message: `Aircraft batch upserted successfully`,
            count,
          });
        } catch (error) {
          console.error('[Tracking API] ❌ Upsert failed:', error);
          throw error;
        }
      }

      default:
        throw APIErrors.BadRequest(`Invalid action: ${action}`);
    }
  } catch (error) {
    console.error(`[Tracking API] ❌ Error:`, error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
