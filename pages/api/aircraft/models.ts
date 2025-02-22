// pages/api/aircraft/models.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import databaseManager from '@/lib/db/managers/staticDatabaseManager';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import trackingDatabaseManager from '@/lib/db/managers/trackingDatabaseManager';

interface StaticModel {
  model: string;
  manufacturer: string;
  count: number;
  activeCount?: number;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const start = Date.now();
  console.log(`[Models API] 📩 Request received:`, {
    method: req.method,
    query: req.query,
    timestamp: new Date().toISOString(),
  });

  if (req.method !== 'GET') {
    console.log(`[Models API] ⚠️ Invalid method: ${req.method}`);
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }

  const manufacturer = req.query.manufacturer as string;
  if (!manufacturer) {
    console.log('[Models API] ⚠️ No manufacturer provided');
    return res
      .status(400)
      .json({ success: false, message: 'Manufacturer parameter is required' });
  }

  try {
    if (!databaseManager.isReady) {
      console.log('[Models API] 🔄 Initializing database');
      await databaseManager.initializeDatabase();
    }

    console.log(
      `[Models API] 📊 Fetching models for manufacturer: ${manufacturer}`
    );

    // Get all models first
    const models = await databaseManager.getModelsByManufacturer(manufacturer);

    // Get active aircraft from tracking database
    const activeAircraft =
      await trackingDatabaseManager.getTrackedAircraft(manufacturer);

    // Create a map of model to active count
    const activeCountsByModel = activeAircraft.reduce((acc, aircraft) => {
      if (aircraft.model) {
        acc.set(aircraft.model, (acc.get(aircraft.model) || 0) + 1);
      }
      return acc;
    }, new Map<string, number>());

    // Only include models with active aircraft
    const formattedModels = models
      .filter(
        (item) => item && item.model && activeCountsByModel.has(item.model)
      )
      .map((model) => ({
        model: model.model,
        manufacturer: model.manufacturer,
        count: model.count,
        activeCount: activeCountsByModel.get(model.model) || 0,
        label: `${model.model} (${activeCountsByModel.get(model.model)} active)`,
      }))
      .sort((a, b) => (b.activeCount || 0) - (a.activeCount || 0)); // Sort by active count

    const responseTime = Date.now() - start;
    console.log('[Models API] ✅ Request stats:', {
      responseTime,
      totalModels: models.length,
      activeModels: formattedModels.length,
      sample: formattedModels.slice(0, 2),
    });

    return res.status(200).json({
      success: true,
      data: formattedModels,
      meta: {
        count: formattedModels.length,
        manufacturer,
        responseTime,
        totalModels: models.length,
        activeModels: formattedModels.length,
      },
    });
  } catch (error) {
    console.error('[Models API] ❌ Error processing request:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export default withErrorHandler(handler);
