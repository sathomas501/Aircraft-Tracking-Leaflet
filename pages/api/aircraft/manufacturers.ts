// pages/api/aircraft/manufacturers.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { StaticDatabaseManager } from '@/lib/db/managers/staticDatabaseManager';
import {
  errorHandler,
  ErrorType,
} from '@/lib/services/error-handler/error-handler';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import type { SelectOption } from '@/types/base';

interface ManufacturersResponse {
  success: boolean;
  manufacturers: SelectOption[];
  cached?: boolean;
  stale?: boolean;
  error?: string;
  message?: string;
  debug?: unknown;
}

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache lifetime
const STALE_TTL = 30 * 60 * 1000; // 30 minutes for stale cache
const QUERY_TIMEOUT = 15000; // 15 seconds timeout

// In-memory cache
let manufacturersCache: SelectOption[] = [];
let cacheTimestamp: number = 0;
let cacheInProgress: Promise<SelectOption[]> | null = null;

async function manufacturersHandler(
  req: NextApiRequest,
  res: NextApiResponse<ManufacturersResponse>
) {
  if (req.method !== 'POST') {
    console.log(`[Manufacturers API] ⚠️ Invalid method: ${req.method}`);
    return res.status(405).json({
      success: false,
      manufacturers: [],
      message: 'Method not allowed. Use POST instead.',
    });
  }

  const now = Date.now();
  const cacheAge = now - cacheTimestamp;
  const cacheIsFresh = cacheAge < CACHE_TTL;
  const cacheIsStale = cacheAge < STALE_TTL;

  // Check if we have fresh cache
  if (manufacturersCache.length > 0 && cacheIsFresh) {
    console.log('[Manufacturers API] ✅ Returning fresh cached data');
    return res.status(200).json({
      success: true,
      manufacturers: manufacturersCache,
      cached: true,
      message: `Returning ${manufacturersCache.length} manufacturers from cache (${Math.round(cacheAge / 1000)}s old)`,
    });
  }

  try {
    // If another request is already fetching data, piggyback on that request
    if (cacheInProgress) {
      console.log('[Manufacturers API] ⏳ Piggybacking on existing request');

      // If we have stale cache, return it immediately while the refresh happens in background
      if (manufacturersCache.length > 0 && cacheIsStale) {
        console.log(
          '[Manufacturers API] ♻️ Returning stale cache while refresh happens'
        );
        res.status(200).json({
          success: true,
          manufacturers: manufacturersCache,
          cached: true,
          stale: true,
          message: `Returning ${manufacturersCache.length} manufacturers from stale cache (${Math.round(cacheAge / 1000)}s old)`,
        });

        // Wait for the ongoing refresh but don't block the response
        try {
          await cacheInProgress;
        } catch (error) {
          console.error(
            '[Manufacturers API] ❌ Background refresh failed:',
            error
          );
        }
        return;
      }

      // No stale cache, wait for the ongoing request
      try {
        const manufacturers = await cacheInProgress;
        return res.status(200).json({
          success: true,
          manufacturers,
          cached: true,
          message: `Successfully fetched ${manufacturers.length} manufacturers (piggybacked)`,
        });
      } catch (error) {
        // If the piggybacked request fails, continue with our own request
        console.error(
          '[Manufacturers API] ❌ Piggybacked request failed:',
          error
        );
      }
    }

    // Start a new fetch operation
    const fetchOperation = async (): Promise<SelectOption[]> => {
      const startTime = Date.now();
      console.log('[Manufacturers API] 🔍 Initializing database...');

      // Get database instance
      const db = await StaticDatabaseManager.getInstance();
      await db.ensureInitialized();

      console.log('[Manufacturers API] 🔍 Verifying database connection...');
      await db.executeQuery('SELECT 1');
      console.log('[Manufacturers API] ✅ Database connection verified');

      // Log some database stats
      console.log('[Manufacturers API] 🔍 Checking database stats...');
      const [aircraftCount, manufacturersCount] = await Promise.all([
        db.executeQuery('SELECT COUNT(*) AS count FROM aircraft'),
        db.executeQuery(
          'SELECT COUNT(DISTINCT manufacturer) AS count FROM aircraft WHERE manufacturer IS NOT NULL AND TRIM(manufacturer) <> ""'
        ),
      ]);

      console.log(
        `[Manufacturers API] 📊 Aircraft table row count: ${(aircraftCount[0] as any)?.count || 'unknown'}`
      );
      console.log(
        `[Manufacturers API] 📊 Manufacturers count: ${(manufacturersCount[0] as any)?.count || 'unknown'}`
      );

      console.log('[Manufacturers API] 🔍 Fetching manufacturers...');

      // Set up the timeout promise
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), QUERY_TIMEOUT)
      );

      // Race the actual query against the timeout
      const result = await Promise.race([
        db.getManufacturersWithCount(50),
        timeoutPromise,
      ]);

      console.log(
        `[Manufacturers API] ✅ Found ${result.length} manufacturers in ${Date.now() - startTime}ms`
      );

      // Transform manufacturers into select options
      return result.map((manufacturer) => ({
        value: manufacturer.name,
        label: `${manufacturer.name} (${manufacturer.count} aircraft)`,
      }));
    };

    // Set up the cache refresh operation
    cacheInProgress = fetchOperation();

    try {
      // Wait for the fetch operation to complete
      const manufacturers = await cacheInProgress;

      // Update cache with new data
      manufacturersCache = manufacturers;
      cacheTimestamp = Date.now();

      return res.status(200).json({
        success: true,
        manufacturers,
        message: `Successfully fetched ${manufacturers.length} manufacturers`,
      });
    } finally {
      // Clear the in-progress promise once done (success or failure)
      cacheInProgress = null;
    }
  } catch (error) {
    console.error('[Manufacturers API] ❌ Error:', error);

    // If we have stale cache, return it for better user experience
    if (manufacturersCache.length > 0 && cacheIsStale) {
      console.log('[Manufacturers API] ♻️ Returning stale cache after error');
      return res.status(200).json({
        success: true,
        manufacturers: manufacturersCache,
        cached: true,
        stale: true,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
        message: `Returning ${manufacturersCache.length} manufacturers from stale cache due to error`,
      });
    }

    // Get database state for debugging
    let debugInfo = {};
    try {
      const db = await StaticDatabaseManager.getInstance();
      const dbState = await db.getDatabaseState();
      debugInfo = {
        ...dbState,
        timestamp: Date.now(),
      };
      console.log('[Manufacturers API] 📊 Database state:', debugInfo);
    } catch (dbError) {
      console.error(
        '[Manufacturers API] ❌ Could not get database state:',
        dbError
      );
    }

    // Log error to error handler
    errorHandler.handleError(
      ErrorType.OPENSKY_SERVICE,
      error instanceof Error
        ? error
        : new Error('Failed to fetch manufacturers'),
      { debugInfo }
    );

    // Handle timeout specifically
    if (error instanceof Error && error.message.includes('timeout')) {
      return res.status(504).json({
        success: false,
        manufacturers: [],
        error: 'Query timed out',
        message: 'The request took too long to process',
        debug: debugInfo,
      });
    }

    // Handle other errors
    return res.status(500).json({
      success: false,
      manufacturers: [],
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      message: 'Failed to fetch manufacturers',
      debug: debugInfo,
    });
  }
}

export default withErrorHandler(manufacturersHandler);
