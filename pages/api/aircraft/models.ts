// pages/api/aircraft/models.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import databaseManager from '@/lib/db/databaseManager';
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

  const { method, query } = req;
  const manufacturer = query.manufacturer as string;

  if (method !== 'GET') {
    console.log(`[Models API] ⚠️ Invalid method: ${method}`);
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }

  if (!manufacturer) {
    console.log('[Models API] ⚠️ No manufacturer provided');
    return res.status(400).json({
      success: false,
      message: 'Manufacturer parameter is required',
    });
  }

  try {
    // Ensure database is initialized
    if (!databaseManager.isReady) {
      console.log('[Models API] 🔄 Initializing database');
      await databaseManager.initializeDatabase();
    }

    const modelsQuery = `
      SELECT model, manufacturer, COUNT(*) as count
      FROM aircraft
      WHERE manufacturer = ?
        AND model IS NOT NULL 
        AND model != ''
      GROUP BY model, manufacturer
      ORDER BY count DESC, model ASC;
    `;

    console.log(
      `[Models API] 📊 Executing query for manufacturer: ${manufacturer}`
    );
    const results = await databaseManager.executeQuery<StaticModel>(
      modelsQuery,
      [manufacturer]
    );

    // Ensure results is an array
    const models = Array.isArray(results) ? results : [results];
    console.log(
      `[Models API] 📋 Found ${models.length} models for ${manufacturer}`
    );

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
      meta: {
        count: formattedModels.length,
        manufacturer,
        responseTime,
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
