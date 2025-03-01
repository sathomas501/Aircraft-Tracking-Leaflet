// pages/api/maintenance/cleanup-stale.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { TrackingDatabaseManager } from '@/lib/db/managers/trackingDatabaseManager';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }

  const { manufacturer } = req.body;

  if (!manufacturer) {
    return res
      .status(400)
      .json({ success: false, message: 'Manufacturer is required' });
  }

  try {
    const trackingDb = TrackingDatabaseManager.getInstance();

    // Delete stale aircraft for this manufacturer
    const twoHoursAgo = Date.now() - 7200000; // 2 hours in milliseconds

    const db = await trackingDb.getDatabase();
    const result = await db.run(
      `DELETE FROM tracked_aircraft 
       WHERE manufacturer = ? AND updated_at < ?`,
      [manufacturer, twoHoursAgo]
    );

    const deletedCount = result?.changes || 0;

    return res.status(200).json({
      success: true,
      deletedCount,
      message: `Deleted ${deletedCount} stale aircraft`,
    });
  } catch (error) {
    console.error('Error cleaning up stale aircraft:', error);
    return res.status(500).json({
      success: false,
      message: 'Error cleaning up stale aircraft',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
