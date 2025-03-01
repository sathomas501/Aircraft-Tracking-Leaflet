// pages/api/tracking/batch.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { TrackingDatabaseManager } from '@/lib/db/managers/trackingDatabaseManager';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { APIErrors } from '@/lib/services/error-handler/api-error';
import { TrackingDataService } from '../../../lib/services/tracking-services/tracking-data-service';
import type { Aircraft } from '@/types/base';

interface BatchUpdate {
  positions: Array<{
    icao24: string;
    latitude: number;
    longitude: number;
    altitude?: number;
    velocity?: number;
    heading?: number;
    on_ground?: boolean;
    manufacturer?: string;
  }>;
}

interface APIResponse {
  success: boolean;
  message: string;
  data?: {
    updated: number;
    total: number;
  };
}

/**
 * API for batch updating aircraft positions
 */
async function handler(req: NextApiRequest, res: NextApiResponse<APIResponse>) {
  if (req.method !== 'POST') {
    throw APIErrors.BadRequest('Method not allowed');
  }

  const { positions } = req.body as BatchUpdate;

  if (!Array.isArray(positions)) {
    throw APIErrors.BadRequest('Invalid positions format');
  }

  const trackingDb = TrackingDatabaseManager.getInstance();
  const trackingService = new TrackingDataService(trackingDb);

  try {
    const updated = await trackingService.updatePositions(positions);

    return res.status(200).json({
      success: true,
      message: `Updated ${updated} aircraft positions`,
      data: {
        updated,
        total: positions.length,
      },
    });
  } catch (error) {
    console.error('[TrackingAPI] Error updating positions:', error);
    throw APIErrors.Internal(
      error instanceof Error ? error : new Error('Unknown error')
    );
  }
}

export default withErrorHandler(handler);
