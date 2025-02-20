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
  error?: string;
  message?: string;
  debug?: unknown;
}

const QUERY_TIMEOUT = 5000; // 5 seconds timeout

async function manufacturersHandler(
  req: NextApiRequest,
  res: NextApiResponse<ManufacturersResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      manufacturers: [],
      error: 'Method not allowed',
      message: 'Only GET requests are allowed',
    });
  }

  const db = StaticDatabaseManager.getInstance();

  try {
    console.log('[Manufacturers API] 🔍 Initializing database...');
    await db.initializeDatabase();

    // Verify database connection
    console.log('[Manufacturers API] 🔍 Verifying database connection...');
    await db.executeQuery('SELECT 1');
    console.log('[Manufacturers API] ✅ Database connection verified');

    // Set query timeout
    console.log('[Manufacturers API] 🔍 Fetching manufacturers...');
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout')), QUERY_TIMEOUT)
    );

    // Execute the actual query with timeout
    const result = await Promise.race([
      db.getManufacturersWithCount(50),
      timeoutPromise,
    ]);

    console.log(`[Manufacturers API] ✅ Found ${result.length} manufacturers`);

    // Transform manufacturers into select options
    const manufacturers = result.map((manufacturer) => ({
      value: manufacturer.name,
      label: `${manufacturer.name} (${manufacturer.count} aircraft)`,
    }));

    return res.status(200).json({
      success: true,
      manufacturers,
      message: `Successfully fetched ${manufacturers.length} manufacturers`,
    });
  } catch (error) {
    console.error('[Manufacturers API] ❌ Error:', error);

    // Get database state for debugging
    let debugInfo = {};
    try {
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
    if (error instanceof Error && error.message.includes('Query timeout')) {
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
