// pages/api/aircraft/models.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const CACHE_TTL = 5000; // 5 seconds

// Cache for request deduplication
const requestCache = new Map<string, Promise<any>>();

/**
 * Dummy implementation of processRequest.
 * Replace this with your actual data fetching logic.
 */
async function processRequest(
  manufacturer: string
): Promise<{ models: any[]; stats: object }> {
  // Simulate some async work (e.g., fetching from a database or external API)
  await new Promise((resolve) => setTimeout(resolve, 100));
  // Return dummy data
  return {
    models: [
      { model: 'Model A', activeCount: 2, totalCount: 10 },
      { model: 'Model B', activeCount: 0, totalCount: 5 },
    ],
    stats: { dummyStat: 123 },
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const startTime = Date.now();

  // Strictly enforce GET method
  if (req.method !== 'GET') {
    console.log(`[Models API] ❌ Method ${req.method} not allowed`);
    return res.status(405).json({
      success: false,
      message: 'Method not allowed - use GET',
    });
  }

  const { manufacturer } = req.query;
  if (!manufacturer || typeof manufacturer !== 'string') {
    console.log('[Models API] ❌ Missing manufacturer parameter');
    return res.status(400).json({
      success: false,
      message: 'Manufacturer parameter required',
    });
  }

  const cacheKey = `models-${manufacturer}`;

  try {
    // Check for in-flight request
    let resultPromise = requestCache.get(cacheKey);

    if (!resultPromise) {
      console.log(`[Models API] 🔄 Processing new request for ${manufacturer}`);
      resultPromise = processRequest(manufacturer);
      requestCache.set(cacheKey, resultPromise);

      // Clear cache entry after TTL
      setTimeout(() => requestCache.delete(cacheKey), CACHE_TTL);
    } else {
      console.log(
        `[Models API] ⏳ Reusing in-flight request for ${manufacturer}`
      );
    }

    // Assert that resultPromise is defined.
    const result = await resultPromise!;
    res.status(200).json({
      success: true,
      data: result.models,
      stats: {
        responseTime: Date.now() - startTime,
        ...result.stats,
      },
    });
  } catch (error) {
    console.error('[Models API] ❌ Error processing request:', error);
    requestCache.delete(cacheKey);
    res.status(500).json({
      success: false,
      message: 'Failed to process request',
    });
  }
}
