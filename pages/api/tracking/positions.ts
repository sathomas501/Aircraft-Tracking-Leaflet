// File: /pages/api/tracking/position.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import BackendDatabaseManager from '@/lib/db/backendDatabaseManager';
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

  const db = await BackendDatabaseManager.getInstance();
  await db.executeQuery(
    `UPDATE tracked_aircraft 
     SET latitude = ?, longitude = ?, heading = ?, updated_at = ?
     WHERE icao24 = ?`,
    [latitude, longitude, heading, Math.floor(Date.now() / 1000), icao24]
  );

  return res.status(200).json({
    success: true,
    message: 'Position updated successfully',
  });
}

export default withErrorHandler(handler);
