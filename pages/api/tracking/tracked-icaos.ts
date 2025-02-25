// pages/api/tracking/tracked-icaos.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { TrackingDatabaseManager } from '@/lib/db/managers/trackingDatabaseManager';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { APIErrors } from '@/lib/services/error-handler/api-error';
import { OpenSkySyncService } from '@/lib/services/openSkySyncService'; // ✅ Added OpenSky service

interface TrackedICAOsResponse {
  success: boolean;
  data?: string[];
  error?: string;
  meta?: {
    count: number;
    timestamp: number;
  };
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TrackedICAOsResponse>
) {
  if (req.method !== 'GET') {
    throw APIErrors.BadRequest('Method not allowed');
  }

  try {
    const trackingDb = TrackingDatabaseManager.getInstance();
    let trackedICAOs = await trackingDb.getTrackedICAOs();

    console.log(
      `[TrackingAPI] ✅ Retrieved ${trackedICAOs.length} tracked ICAOs`
    );

    // ✅ Fetch missing aircraft from OpenSky if the DB is empty
    if (trackedICAOs.length === 0) {
      console.log(
        `[TrackingAPI] No ICAOs in tracking DB. Fetching from OpenSky...`
      );
      const openSkySyncService = OpenSkySyncService.getInstance();
      const freshAircraft = await openSkySyncService.fetchLiveAircraft([]);

      if (freshAircraft.length > 0) {
        trackedICAOs = freshAircraft.map((ac) => ac.icao24);
        console.log(
          `[TrackingAPI] ✅ Fetched ${freshAircraft.length} aircraft from OpenSky`
        );
      }
    }

    return res.status(200).json({
      success: true,
      data: trackedICAOs,
      meta: {
        count: trackedICAOs.length,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error('[TrackingAPI] ❌ Error fetching tracked ICAOs:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch tracked ICAOs',
    });
  }
}

export default withErrorHandler(handler);
