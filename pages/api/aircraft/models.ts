// pages/api/aircraft/models.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { StaticDatabaseManager } from '@/lib/db/managers/staticDatabaseManager';
import trackingDatabaseManagerPromise from '@/lib/db/managers/trackingDatabaseManager';

// Cache for models data
let modelsCache: Record<string, { models: any[]; timestamp: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const API_TIMEOUT = 15000; // 15 seconds

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
    });
  }

  const { manufacturer } = req.body;

  if (!manufacturer) {
    return res.status(400).json({
      success: false,
      message: 'Manufacturer is required',
    });
  }

  // Check cache first (unless force refresh is requested)
  if (
    !req.body.refresh &&
    modelsCache[manufacturer] &&
    Date.now() - modelsCache[manufacturer].timestamp < CACHE_TTL
  ) {
    return res.status(200).json({
      success: true,
      models: modelsCache[manufacturer].models,
      cached: true,
    });
  }

  try {
    // Set up timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout')), API_TIMEOUT)
    );

    // Setup actual query
    const queryPromise = async () => {
      console.log(`[Models API] Getting models for ${manufacturer}`);

      // Get database instances
      const staticDb = await StaticDatabaseManager.getInstance();
      const trackingDb = await trackingDatabaseManagerPromise;

      // Fetch models from static database first
      const staticModels = await staticDb.getModelsByManufacturer(manufacturer);

      if (!staticModels || staticModels.length === 0) {
        return { models: [] };
      }

      // Enhance with tracking data if available
      try {
        const trackedAircraft =
          await trackingDb.getTrackedAircraft(manufacturer);

        // Create a map of active aircraft by model
        const activeModelCounts = new Map();

        for (const aircraft of trackedAircraft) {
          if (!aircraft.model) continue;

          const count = activeModelCounts.get(aircraft.model) || 0;
          activeModelCounts.set(aircraft.model, count + 1);
        }

        // Update active counts on models
        const modelsWithCounts = staticModels.map((model) => ({
          ...model,
          activeCount: activeModelCounts.get(model.model) || 0,
        }));

        // Sort models by active count (desc) then by name
        const sortedModels = modelsWithCounts.sort((a, b) => {
          const countDiff = (b.activeCount || 0) - (a.activeCount || 0);
          return countDiff !== 0 ? countDiff : a.model.localeCompare(b.model);
        });

        return { models: sortedModels };
      } catch (trackingError) {
        console.error(
          '[Models API] Failed to enhance with tracking data:',
          trackingError
        );
        // Return just the static models if tracking data fails
        return { models: staticModels };
      }
    };

    // Race between the timeout and query
    const result = (await Promise.race([queryPromise(), timeoutPromise])) as {
      models: any[];
    };

    // Update cache
    modelsCache[manufacturer] = {
      models: result.models,
      timestamp: Date.now(),
    };

    return res.status(200).json({
      success: true,
      models: result.models,
      count: result.models.length,
    });
  } catch (error) {
    console.error('[Models API] Error:', error);

    // Return cached data if available, even if expired
    if (modelsCache[manufacturer]) {
      return res.status(200).json({
        success: true,
        models: modelsCache[manufacturer].models,
        count: modelsCache[manufacturer].models.length,
        cached: true,
        stale: true,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : 'Failed to fetch models',
      models: [],
    });
  }
}
