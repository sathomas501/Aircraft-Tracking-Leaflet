import type { NextApiRequest, NextApiResponse } from 'next';
import { TrackingDatabaseManager } from '@/lib/db/managers/trackingDatabaseManager';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { APIErrors } from '@/lib/services/error-handler/api-error';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    throw APIErrors.BadRequest('Method not allowed');
  }

  try {
    const db = TrackingDatabaseManager.getInstance();
    await db.initializeDatabase();

    // ✅ Query the database to fetch tracked ICAO24s
    const trackedICAOs = await db.getTrackedICAOs();

    return res.status(200).json({
      success: true,
      data: trackedICAOs, // Returns an array of ICAO24s
    });
  } catch (error) {
    console.error('[Tracking API] ❌ Error fetching tracked ICAOs:', error);
    throw APIErrors.Internal(
      error instanceof Error
        ? error
        : new Error('Failed to fetch tracked ICAOs')
    );
  }
}

export default withErrorHandler(handler);
