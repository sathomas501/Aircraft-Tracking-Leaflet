// pages/api/tracking/position.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { TrackingDatabaseManager } from '@/lib/db/managers/trackingDatabaseManager';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { APIErrors } from '@/lib/services/error-handler/api-error';
import { TrackingDataService } from '../../../lib/services/tracking-services/tracking-data-service';

interface PositionUpdate {
  icao24: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  velocity?: number;
  heading?: number;
  on_ground?: boolean;
  manufacturer?: string;
}

interface APIResponse {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * API for updating individual aircraft positions
 */
async function handler(req: NextApiRequest, res: NextApiResponse<APIResponse>) {
  if (req.method !== 'POST') {
    throw APIErrors.BadRequest('Method not allowed');
  }

  const trackingDb = TrackingDatabaseManager.getInstance();
  const trackingService = new TrackingDataService(trackingDb);
  const { icao24, position } = req.body;

  if (!icao24 || !position || typeof position !== 'object') {
    throw APIErrors.BadRequest('Invalid request format');
  }

  const { latitude, longitude, heading } = position;
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    typeof heading !== 'number'
  ) {
    throw APIErrors.BadRequest('Missing required position fields');
  }

  try {
    const success = await trackingService.updateSinglePosition(
      icao24,
      position
    );

    if (success) {
      return res.status(200).json({
        success: true,
        message: `Updated position for ${icao24}`,
      });
    } else {
      return res.status(404).json({
        success: false,
        message: `Aircraft ${icao24} not found`,
      });
    }
  } catch (error) {
    console.error('[TrackingAPI] Error updating position:', error);
    throw APIErrors.Internal(
      error instanceof Error ? error : new Error('Unknown error')
    );
  }
}

export default withErrorHandler(handler);
