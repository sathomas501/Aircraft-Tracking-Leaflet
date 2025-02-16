// pages/api/aircraft/manufacturers.ts
import { NextApiRequest, NextApiResponse } from 'next';
import databaseManager from '@/lib/db/databaseManager';
import {
  errorHandler,
  ErrorType,
} from '@/lib/services/error-handler/error-handler';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import type { SelectOption } from '@/types/base';

interface ManufacturersResponse {
  success: boolean;
  manufacturers: SelectOption[];
  error?: string;
  message?: string;
  debug?: unknown;
}

async function manufacturersHandler(
  req: NextApiRequest,
  res: NextApiResponse<ManufacturersResponse>
) {
  const QUERY_TIMEOUT = 5000; // 5 seconds timeout

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      manufacturers: [],
      error: 'Method not allowed',
      message: 'Only GET requests are allowed',
    });
  }

  try {
    // First check database status
    console.log('[Manufacturers API] 🔍 Checking database status...');
    if (!databaseManager.isReady) {
      console.log('[Manufacturers API] 🔄 Initializing database...');
      await databaseManager.initializeDatabase();
    }

    // Verify database connection
    console.log('[Manufacturers API] 🔍 Verifying database connection...');
    const testQuery = 'SELECT 1';
    await databaseManager.executeQuery(testQuery);
    console.log('[Manufacturers API] ✅ Database connection verified');

    // Set query timeout
    console.log('[Manufacturers API] 🔍 Fetching manufacturers...');
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout')), QUERY_TIMEOUT)
    );

    // Execute the actual query
    const queryPromise = databaseManager.executeQuery<{
      name: string;
      count: number;
    }>(
      `SELECT name, count FROM (
        SELECT
          TRIM(manufacturer) AS name,
          COUNT(*) AS count
        FROM aircraft
        WHERE manufacturer IS NOT NULL
        AND TRIM(manufacturer) != ''
        GROUP BY TRIM(manufacturer)
        HAVING count > 0
        ORDER BY count DESC
        LIMIT 50
      ) AS TopManufacturers
      ORDER BY name ASC`
    );

    // Race between query and timeout
    const result = await Promise.race([queryPromise, timeoutPromise]);

    // Check results
    if (!Array.isArray(result)) {
      throw new Error('Invalid query result format');
    }

    console.log(`[Manufacturers API] ✅ Found ${result.length} manufacturers`);

    // Transform and validate manufacturers
    const manufacturers = result
      .filter((m) => m && m.name && m.count)
      .map((manufacturer) => ({
        value: manufacturer.name,
        label: `${manufacturer.name} (${manufacturer.count} aircraft)`,
      }));

    return res.status(200).json({
      success: true,
      manufacturers,
      message: `Successfully fetched ${manufacturers.length} manufacturers`,
    });
  } catch (error) {
    // Handle specific error types
    console.error('[Manufacturers API] ❌ Error:', error);

    // Get database state for debugging
    let debugInfo = {};
    try {
      debugInfo = await databaseManager.getDatabaseState();
      console.log('[Manufacturers API] 📊 Database state:', debugInfo);
    } catch (dbError) {
      console.error(
        '[Manufacturers API] ❌ Could not get database state:',
        dbError
      );
    }

    errorHandler.handleError(
      ErrorType.OPENSKY_SERVICE,
      error instanceof Error
        ? error
        : new Error('Failed to fetch manufacturers'),
      { debugInfo }
    );

    if (error instanceof Error && error.message.includes('Query timeout')) {
      return res.status(504).json({
        success: false,
        manufacturers: [],
        error: 'Query timed out',
        message: 'The request took too long to process',
        debug: debugInfo,
      });
    }

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
