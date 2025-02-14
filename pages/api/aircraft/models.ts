// pages/api/aircraft/models.ts
import { NextApiRequest, NextApiResponse } from 'next';
import databaseManager from '../../../lib/db/databaseManager';
import trackingDatabaseManager from '../../../lib/db/trackingDatabaseManager';

interface ActiveModel {
  model: string;
  activeCount: number;
}

// pages/api/aircraft/models.ts
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { method, query } = req;

    if (method !== 'GET') {
      return res
        .status(405)
        .json({ success: false, message: 'Method not allowed' });
    }

    const manufacturer = query.manufacturer as string;
    if (!manufacturer) {
      return res.status(400).json({
        success: false,
        message: 'Manufacturer query parameter is required.',
      });
    }

    console.log(
      `[API] Fetching active models for manufacturer: ${manufacturer}`
    );

    await trackingDatabaseManager.initialize();

    // Query only from tracked_aircraft table
    const activeModelsQuery = `
  SELECT a.model, COUNT(a.icao24) as activeCount
  FROM active_tracking a
  WHERE a.manufacturer = ?
  GROUP BY a.model
  HAVING COUNT(a.icao24) > 0
  ORDER BY activeCount DESC
`;

    try {
      console.time(`[API] Active Model Query Execution`);

      const activeModels = await trackingDatabaseManager.executeQuery(
        activeModelsQuery,
        []
      );

      console.timeEnd(`[API] Active Model Query Execution`);

      if (!activeModels.length) {
        console.warn(
          `[API] No active models found for manufacturer: ${manufacturer}`
        );
      } else {
        console.log(`[API] Found ${activeModels.length} active models`);
        console.log('[API] Active models:', activeModels);
      }

      return res.status(200).json({
        success: true,
        message: `Found ${activeModels.length} active models for ${manufacturer}`,
        data: activeModels,
      });
    } catch (error) {
      console.error(`[API] Database error:`, error);
      return res.status(500).json({
        success: false,
        message: 'Database query failed.',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  } catch (error) {
    console.error('[API] Internal Server Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}
