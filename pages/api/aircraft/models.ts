import { NextApiRequest, NextApiResponse } from 'next';
import databaseManager from '../../../lib/db/databaseManager';
import BackendDatabaseManager from '../../../lib/db/backendDatabaseManager';

// Types for database results
interface StaticModel {
  model: string;
}

interface ActiveModel {
  model: string;
  activeCount: number;
}

interface ModelWithCounts extends StaticModel {
  activeCount: number;
  isActive: boolean;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { method, query } = req;

    if (method !== 'GET') {
      return res.status(405).json({
        success: false,
        message: 'Method not allowed',
      });
    }

    const manufacturer = query.manufacturer as string;
    if (!manufacturer) {
      return res.status(400).json({
        success: false,
        message: 'Manufacturer query parameter is required.',
      });
    }

    console.log(`[API] Fetching models for manufacturer: ${manufacturer}`);

    // Initialize database managers
    const [trackingManager] = await Promise.all([
      BackendDatabaseManager.getInstance(),
      databaseManager.initializeDatabase(),
    ]);

    // Fetch models from static database
    const staticModelsQuery = `
      SELECT DISTINCT model FROM aircraft
      WHERE manufacturer = ?
      ORDER BY model;
    `;

    let staticModelsResult = await databaseManager.executeQuery<StaticModel[]>(
      staticModelsQuery,
      [manufacturer]
    );

    // Ensure the result is a flat array
    const staticModels: StaticModel[] = Array.isArray(staticModelsResult)
      ? staticModelsResult
          .flat()
          .filter(
            (item) =>
              item &&
              typeof item === 'object' &&
              'model' in item &&
              typeof item.model === 'string'
          )
      : [];

    console.log(`[API] Found ${staticModels.length} models in static DB`);

    // Fetch active aircraft models from tracking DB
    const activeModelsQuery = `
      SELECT 
        model, 
        COUNT(icao24) as activeCount
      FROM active_tracking
      WHERE manufacturer = ? AND model IS NOT NULL
      GROUP BY model
      HAVING model != ''
      ORDER BY model;
    `;

    let activeModelsResult = await trackingManager.executeQuery<ActiveModel[]>(
      activeModelsQuery,
      [manufacturer]
    );

    // Ensure active models are correctly typed
    const activeModels: ActiveModel[] = Array.isArray(activeModelsResult)
      ? activeModelsResult
          .flat()
          .filter(
            (item) =>
              item &&
              typeof item === 'object' &&
              'model' in item &&
              typeof item.model === 'string' &&
              'activeCount' in item &&
              typeof item.activeCount === 'number'
          )
      : [];

    console.log(`[API] Found ${activeModels.length} active models`);

    // Merge static and active model data
    const activeModelMap = new Map<string, number>(
      activeModels.map((row) => [row.model, row.activeCount])
    );

    const modelsWithCounts: ModelWithCounts[] = staticModels.map((row) => ({
      model: row.model,
      activeCount: activeModelMap.get(row.model) || 0,
      isActive: (activeModelMap.get(row.model) || 0) > 0,
    }));

    return res.status(200).json({
      success: true,
      message: `Found ${modelsWithCounts.length} models for ${manufacturer}`,
      data: modelsWithCounts,
    });
  } catch (error) {
    console.error('[API] Internal Server Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
