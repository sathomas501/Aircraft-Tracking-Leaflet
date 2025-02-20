// pages/api/tracking/positions.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { TrackingDatabaseManager } from '@/lib/db/managers/trackingDatabaseManager';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { APIErrors } from '@/lib/services/error-handler/api-error';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    throw APIErrors.BadRequest('Method not allowed');
  }

  const { icao24, latitude, longitude, heading } = req.body;

  if (
    !icao24 ||
    typeof latitude !== 'number' ||
    typeof longitude !== 'number'
  ) {
    throw APIErrors.BadRequest('Missing required fields');
  }

  const db = TrackingDatabaseManager.getInstance();
  await db.initializeDatabase();

  try {
    await db.updatePosition(icao24, latitude, longitude, heading);

    return res.status(200).json({
      success: true,
      message: 'Position updated successfully',
    });
  } catch (error) {
    throw APIErrors.Internal(
      error instanceof Error ? error : new Error('Failed to update position')
    );
  }
}

export default withErrorHandler(handler);
