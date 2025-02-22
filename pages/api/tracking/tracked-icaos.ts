// pages/api/tracking/tracked-icaos.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { TrackingDatabaseManager } from '@/lib/db/managers/trackingDatabaseManager';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { APIErrors } from '@/lib/services/error-handler/api-error';

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
    const trackedICAOs = await trackingDb.getTrackedICAOs();

    console.log(
      `[TrackingAPI] ✅ Retrieved ${trackedICAOs.length} tracked ICAOs`
    );

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
    throw APIErrors.Internal(
      error instanceof Error
        ? error
        : new Error('Failed to fetch tracked ICAOs')
    );
  }
}

export default withErrorHandler(handler);
