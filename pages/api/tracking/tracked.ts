// File: /pages/api/tracking/tracked.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import BackendDatabaseManager from '@/lib/db/backendDatabaseManager';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { Aircraft } from '@/types/base';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = await BackendDatabaseManager.getInstance();
  const staleThreshold = Math.floor(Date.now() / 1000) - 2 * 60 * 60; // 2 hours

  const trackedAircraft = await db.executeQuery<Aircraft[]>(
    'SELECT * FROM tracked_aircraft WHERE last_contact > ? ORDER BY last_contact DESC',
    [staleThreshold]
  );

  return res.status(200).json({
    success: true,
    data: trackedAircraft,
  });
}

export default withErrorHandler(handler);
