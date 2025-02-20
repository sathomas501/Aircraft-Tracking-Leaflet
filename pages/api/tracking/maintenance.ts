// pages/api/tracking/maintenance.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { TrackingDatabaseManager } from '@/lib/db/managers/trackingDatabaseManager';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { APIErrors } from '@/lib/services/error-handler/api-error';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    throw APIErrors.BadRequest('Method not allowed');
  }

  const db = TrackingDatabaseManager.getInstance();
  await db.initializeDatabase();

  try {
    const results = await db.performMaintenance(); // 2 hours stale threshold

    return res.status(200).json({
      success: true,
      message: 'Maintenance completed successfully',
      details: {
        ...results,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    throw APIErrors.Internal(
      error instanceof Error ? error : new Error('Maintenance operation failed')
    );
  }
}

export default withErrorHandler(handler);
