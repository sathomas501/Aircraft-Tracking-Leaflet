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

    console.log(`[API] Fetching models for manufacturer: ${manufacturer}`);

    // Initialize database managers
    const [trackingManager] = await Promise.all([
      BackendDatabaseManager.getInstance(),
      databaseManager.initializeDatabase(),
    ]);

    // ✅ Step 1: Fetch models from the static database (`static.db`)
    const staticModelsQuery = `
      SELECT DISTINCT model FROM aircraft
      WHERE manufacturer = ?
      ORDER BY model;
    `;

    let staticModelsResult = await databaseManager.executeQuery<StaticModel[]>(
      staticModelsQuery,
      [manufacturer]
    );

    const staticModels: StaticModel[] = Array.isArray(staticModelsResult)
      ? staticModelsResult
          .flat()
          .filter((item) => item && typeof item.model === 'string')
      : [];

    console.log(`[API] Found ${staticModels.length} models in static DB`);

    // ✅ Step 2: Check if any active aircraft exist before querying `tracking.db`
    const activeAircraftQuery = `SELECT COUNT(*) as count FROM active_tracking WHERE manufacturer = ?`;
    const activeAircraftResult = await trackingManager.executeQuery<
      { count: number }[]
    >(activeAircraftQuery, [manufacturer]);

    const activeCount =
      activeAircraftResult.length > 0 ? activeAircraftResult[0].count : 0;

    console.log(`[API] Active aircraft count: ${activeCount}`);

    let modelsWithCounts = staticModels.map((row) => ({
      model: row.model,
      activeCount: 0, // Default to 0
      isActive: false,
    }));

    // ✅ Step 3: Only query `tracking.db` for active models if active aircraft exist
    if (activeCount > 0) {
      console.log(`[API] Fetching active models from tracking DB...`);

      const activeModelsQuery = `
        SELECT model, COUNT(icao24) as activeCount
        FROM active_tracking
        WHERE manufacturer = ? AND model IS NOT NULL
        GROUP BY model
        HAVING model != ''
        ORDER BY model;
      `;

      let activeModelsResult = await trackingManager.executeQuery<
        ActiveModel[]
      >(activeModelsQuery, [manufacturer]);

      const activeModels: ActiveModel[] = Array.isArray(activeModelsResult)
        ? activeModelsResult
            .flat()
            .filter(
              (item) =>
                item &&
                typeof item.model === 'string' &&
                typeof item.activeCount === 'number'
            )
        : [];

      console.log(`[API] Found ${activeModels.length} active models`);

      // ✅ Merge static models with active aircraft counts
      const activeModelMap = new Map<string, number>(
        activeModels.map((row) => [row.model, row.activeCount])
      );

      modelsWithCounts = modelsWithCounts.map((model) => ({
        model: model.model,
        activeCount: activeModelMap.get(model.model) || 0,
        isActive: (activeModelMap.get(model.model) || 0) > 0,
      }));
    } else {
      console.log(
        `[API] No active aircraft found. Skipping tracking DB query.`
      );
    }

    return res.status(200).json({
      success: true,
      message: `Found ${modelsWithCounts.length} models for ${manufacturer}`,
      data: modelsWithCounts,
    });
  } catch (error) {
    console.error('[API] Internal Server Error:', (error as Error).message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
