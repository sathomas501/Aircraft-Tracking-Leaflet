// pages/api/aircraft/models.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import databaseManager from '@/lib/db/managers/staticDatabaseManager';
import { withErrorHandler } from '@/lib/middleware/error-handler';

interface StaticModel {
  model: string;
  manufacturer: string;
  count: number;
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
    const models = await databaseManager.getModelsByManufacturer(manufacturer);

    const formattedModels = models
      .filter((item) => item && item.model)
      .map((model) => ({
        model: model.model,
        manufacturer: model.manufacturer,
        count: model.count,
        label: `${model.model} (${model.count} aircraft)`,
      }));

    const responseTime = Date.now() - start;
    console.log(
      `[Models API] ✅ Request completed in ${responseTime}ms, returning ${formattedModels.length} models`
    );

    return res.status(200).json({
      success: true,
      data: formattedModels,
      meta: { count: formattedModels.length, manufacturer, responseTime },
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
