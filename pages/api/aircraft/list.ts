// pages/api/manufacturers/list.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { StaticDatabaseManager } from '@/lib/db/managers/staticDatabaseManager';
import { APIErrors } from '@/lib/services/error-handler/api-error';
import { withErrorHandler } from '@/lib/middleware/error-handler';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    throw APIErrors.BadRequest('Method not allowed');
  }

  try {
    const db = await StaticDatabaseManager.getInstance(); // Await the instance
    await db.initializeDatabase();

    const limit = Number(req.query.limit) || 50;
    const manufacturers = await db.getManufacturersWithCount(limit);

    return res.status(200).json({
      success: true,
      data: {
        manufacturers,
        meta: {
          total: manufacturers.length,
          timestamp: Date.now(),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching manufacturers:', error);
    return res
      .status(500)
      .json({ success: false, error: 'Internal Server Error' });
  }
}

export default withErrorHandler(handler);
