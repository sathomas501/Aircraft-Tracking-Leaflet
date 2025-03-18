import { NextApiRequest, NextApiResponse } from 'next';
import { StaticDatabaseManager } from '@/lib/db/managers/staticDatabaseManager';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import type { SelectOption } from '@/types/base';

interface ManufacturersResponse {
  success: boolean;
  manufacturers: SelectOption[];
  cached?: boolean;
  stale?: boolean;
  error?: string;
  message?: string;
}

// ✅ Cache settings
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const QUERY_TIMEOUT = 15000; // 15 seconds

// ✅ Global cache state
let manufacturersCache: SelectOption[] = [];
let cacheTimestamp: number = 0;
let cacheInProgress: Promise<SelectOption[]> | null = null;

async function manufacturersHandler(
  req: NextApiRequest,
  res: NextApiResponse<ManufacturersResponse>
) {
  console.log('[Manufacturers API] 📡 Received request');

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      manufacturers: [],
      message: 'Method Not Allowed. Use POST instead.',
    });
  }

  const now = Date.now();
  const cacheAge = now - cacheTimestamp;
  const cacheIsFresh = cacheAge < CACHE_TTL;

  // ✅ Return cache immediately if fresh
  if (manufacturersCache.length > 0 && cacheIsFresh) {
    console.log(
      `[Manufacturers API] ✅ Using fresh cache (${cacheAge / 1000}s old)`
    );
    return res.status(200).json({
      success: true,
      manufacturers: manufacturersCache,
      cached: true,
      message: `Returning ${manufacturersCache.length} manufacturers from cache`,
    });
  }

  // ✅ Piggyback on ongoing request
  if (cacheInProgress) {
    console.log('[Manufacturers API] ⏳ Piggybacking on existing request');
    try {
      const piggybackedData = await cacheInProgress;
      return res.status(200).json({
        success: true,
        manufacturers: piggybackedData,
        cached: true,
        message: `Piggybacked request successful`,
      });
    } catch (error) {
      console.error(
        '[Manufacturers API] ❌ Piggybacking failed, retrying:',
        error
      );
    }
  }

  // ✅ Start a new fetch operation
  console.log('[Manufacturers API] 🔄 Fetching manufacturers from Static DB');
  cacheInProgress = fetchManufacturersFromDB();

  try {
    const manufacturers = await cacheInProgress;
    return res.status(200).json({
      success: true,
      manufacturers,
      message: `Successfully fetched ${manufacturers.length} manufacturers`,
    });
  } catch (error) {
    console.error(
      '[Manufacturers API] ❌ Failed to fetch manufacturers:',
      error
    );
    return res.status(500).json({
      success: false,
      manufacturers: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to fetch manufacturers',
    });
  } finally {
    cacheInProgress = null;
    console.log('[Manufacturers API] 🔄 Cleared cache in-progress flag');
  }
}

/**
 * ✅ Fetches manufacturers from Static DB using BaseDatabaseManager
 */
async function fetchManufacturersFromDB(): Promise<SelectOption[]> {
  try {
    const staticDb = await StaticDatabaseManager.getInstance();

    console.log(
      '[Manufacturers API] 🔍 Querying Static DB for top manufacturers...'
    );
    const result = await staticDb.query(`
      SELECT manufacturer AS name, COUNT(*) as count
      FROM aircraft
      GROUP BY manufacturer
      ORDER BY count DESC
      LIMIT 50
    `);

    // ✅ Convert DB result to SelectOptions
    manufacturersCache = result.map((m: { name: string; count: number }) => ({
      value: m.name,
      label: `${m.name} (${m.count} aircraft)`,
    }));

    cacheTimestamp = Date.now();
    console.log(
      `[Manufacturers API] ✅ Cached ${manufacturersCache.length} manufacturers`
    );

    return manufacturersCache;
  } catch (error) {
    console.error(
      '[Manufacturers API] ❌ Error fetching from Static DB:',
      error
    );
    throw new Error('Database query failed');
  }
}

export default withErrorHandler(manufacturersHandler);
