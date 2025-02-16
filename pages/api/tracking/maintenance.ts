// File: /pages/api/tracking/maintenance.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import BackendDatabaseManager from '@/lib/db/backendDatabaseManager';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { APIErrors } from '@/lib/services/error-handler/api-error';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    throw APIErrors.BadRequest('Method not allowed');
  }

  const db = await BackendDatabaseManager.getInstance();
  const staleThreshold = Math.floor(Date.now() / 1000) - 2 * 60 * 60;

  // Clean stale records
  await db.executeQuery('DELETE FROM tracked_aircraft WHERE last_contact < ?', [
    staleThreshold,
  ]);

  // Optimize database
  await db.executeQuery('VACUUM');
  await db.executeQuery('ANALYZE');

  return res.status(200).json({
    success: true,
    message: 'Maintenance completed successfully',
  });
}

export default withErrorHandler(handler);
