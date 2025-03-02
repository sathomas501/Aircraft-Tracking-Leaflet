// pages/api/tracking/batch.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { TrackingDatabaseManager } from '@/lib/db/managers/trackingDatabaseManager';
import { APIErrors } from '@/lib/services/error-handler/api-error';
import { TrackingDataService } from '../../../lib/services/tracking-services/tracking-data-service';
import { BatchUpdate } from '../../../types/requests';

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

  const { positions, manufacturer } = req.body as BatchUpdate;

  if (!Array.isArray(positions) || !manufacturer) {
    throw APIErrors.BadRequest(
      'Invalid request: positions or manufacturer missing'
    );
  }

  const trackingDb = TrackingDatabaseManager.getInstance();
  const trackingService = new TrackingDataService(trackingDb);

  try {
    // ✅ Pass manufacturer as the second argument
    const updated = await trackingService.updatePositions(
      positions,
      manufacturer
    );

    return res.status(200).json({
      success: true,
      message: `Updated ${updated} aircraft positions for ${manufacturer}`,
      data: {
        updated,
        total: positions.length,
      },
    });
  } catch (error) {
    console.error('[TrackingAPI] ❌ Error updating positions:', error);
    throw APIErrors.Internal(
      error instanceof Error ? error : new Error('Unknown error')
    );
  }
}

export default handler;
