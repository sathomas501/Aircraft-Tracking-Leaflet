// pages/api/aircraft/models.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import dbManager from '../../../lib/db/DatabaseManager';
import openSkyTrackingService from '../../../lib/services/openSkyTrackingService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { manufacturer, refresh } = req.body;

  if (!manufacturer) {
    return res.status(400).json({
      error: 'Manufacturer parameter required',
    });
  }

  try {
    console.log(
      `[API] Fetching models for ${manufacturer}${refresh ? ' (refresh)' : ''}`
    );

    // Get models from database
    const cacheKey = refresh
      ? `models-${manufacturer}-${Date.now()}`
      : `models-${manufacturer}`;
    const query = `
      SELECT 
        model,
        manufacturer,
        COUNT(DISTINCT icao24) as total_count,
        MAX(name) as name,
        MAX(city) as city,
        MAX(state) as state,
        MAX(owner_type) as ownerType
      FROM aircraft
      WHERE manufacturer = ?
      GROUP BY model, manufacturer
      ORDER BY total_count DESC
    `;

    const dbModels = await dbManager.query(
      cacheKey,
      query,
      [manufacturer],
      refresh ? 0 : 300 // No cache on refresh, otherwise 5 min cache
    );

    // Get tracked aircraft information to enhance models with active counts
    const trackedAircraft =
      openSkyTrackingService.isTrackingActive() &&
      openSkyTrackingService.getCurrentManufacturer() === manufacturer
        ? openSkyTrackingService.getTrackedAircraft()
        : [];

    // Create model active count mapping
    const activeModelCounts = new Map();

    trackedAircraft.forEach((aircraft) => {
      if (!aircraft.model) return;

      const count = activeModelCounts.get(aircraft.model) || 0;
      activeModelCounts.set(aircraft.model, count + 1);
    });

    // Enhance models with active counts
    const enhancedModels = dbModels.map((model: any) => ({
      ...model,
      activeCount: activeModelCounts.get(model.model as string) || 0,
    }));

    // Sort models: first by active count desc, then by total_count desc
    const sortedModels = enhancedModels.sort((a, b) => {
      const activeCountDiff = (b.activeCount || 0) - (a.activeCount || 0);
      return activeCountDiff !== 0
        ? activeCountDiff
        : (b.total_count || 0) - (a.total_count || 0);
    });

    return res.status(200).json({
      models: sortedModels,
      count: sortedModels.length,
      totalActive: trackedAircraft.length,
      manufacturer,
    });
  } catch (error) {
    console.error('[API] Error fetching models:', error);
    return res.status(500).json({
      error: 'Failed to fetch models',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
