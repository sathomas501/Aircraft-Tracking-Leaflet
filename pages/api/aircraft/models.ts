import type { NextApiRequest, NextApiResponse } from 'next';
import staticDatabaseManager from '../../../lib/db/managers/staticDatabaseManager';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import CacheManager from '../../../lib/services/managers/cache-manager'; // ✅ Use the correct cache manager import

export interface ActiveModel {
  model: string;
  manufacturer: string;
  count: number;
  city?: string;
  state?: string;
  OWNER_TYPE?: string;
  name?: string;
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
  const cache = new CacheManager<ActiveModel[]>(300); // Cache expires in 300 seconds

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
    // ✅ Define cache key for the manufacturer
    const cacheKey = `models:${manufacturer}`;

    // ✅ Check if models are already cached
    const cachedData = cache.get(cacheKey); // ✅ Now it's an instance method
    if (cachedData) {
      console.log('[Models API] ✅ Returning cached data');
      return res.status(200).json({
        success: true,
        data: cachedData,
      });
    }

    // ✅ Ensure database is initialized
    if (!staticDatabaseManager.isReady) {
      console.log('[Models API] 🔄 Initializing database');
      await staticDatabaseManager.initializeDatabase();
    }

    // ✅ Fetch models from the database
    console.log(
      `[Models API] 📊 Fetching models for manufacturer: ${manufacturer}`
    );
    const models =
      await staticDatabaseManager.getModelsByManufacturer(manufacturer);

    const results: ActiveModel[] = models.map((model) => ({
      model: model.model,
      manufacturer: model.manufacturer,
      count: model.count,
      CITY: model.city || '',
      STATE: model.state || '',
      OWNER_TYPE: model.ownerType || '',
      NAME: model.name || '',
    }));

    console.log(
      `[Models API] 📋 Found ${results.length} models for ${manufacturer}`
    );

    const formattedModels = results
      .filter((item) => item && item.model)
      .map((model) => ({
        model: model.model,
        manufacturer: model.manufacturer,
        count: model.count,
        label: `${model.model} (${model.count} aircraft)`,
      }));

    // ✅ Cache the fetched models for future requests
    cache.set(cacheKey, formattedModels); // ✅ Use the instance

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
