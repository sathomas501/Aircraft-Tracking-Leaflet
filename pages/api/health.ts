// pages/api/health.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { TrackingDatabaseManager } from '@/lib/db/managers/trackingDatabaseManager';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { APIErrors } from '@/lib/services/error-handler/api-error';

interface HealthResponse {
  status: string;
  uptime: number;
  databases: {
    tracking: {
      status: string;
      tables?: string[];
      cacheStatus?: {
        manufacturersAge: number | null;
        icaosAge: number | null;
      };
      details?: {
        hasRequiredTables: boolean;
        connectionCheck: boolean;
      };
    };
  };
  timestamp: number;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthResponse>
) {
  if (req.method !== 'POST') {
    throw APIErrors.BadRequest('Method not allowed');
  }

  try {
    console.log('[HealthAPI] 🏥 Performing health check');

    // ✅ Await the database instance before using it
    const trackingDb = await TrackingDatabaseManager.getInstance();

    // ✅ Ensure the database is initialized
    await trackingDb.ensureInitialized();

    // ✅ Await before accessing properties
    const isDbReady = await trackingDb.isReady;

    // ✅ Check connection by running a test query
    let connectionCheck = false;
    try {
      const testQuery = await trackingDb.executeQuery('SELECT 1 as test');
      connectionCheck = testQuery.length > 0;
    } catch (error) {
      console.error('[HealthAPI] Database connection test failed:', error);
    }

    // ✅ Fetch and type-check table names
    let tableNames: string[] = [];
    try {
      const tables: { name: string }[] = await trackingDb.executeQuery(
        "SELECT name FROM sqlite_master WHERE type='table';"
      );

      tableNames = tables.map((row) => row.name);
    } catch (error) {
      console.error('[HealthAPI] Failed to fetch table names:', error);
    }

    return res.status(200).json({
      status: 'healthy',
      uptime: process.uptime(),
      databases: {
        tracking: {
          status: isDbReady ? 'ready' : 'not ready',
          tables: tableNames,
          details: {
            hasRequiredTables: tableNames.includes('tracked_aircraft'),
            connectionCheck,
          },
        },
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[HealthAPI] Error during health check:', error);
    return res.status(500).json({
      status: 'unhealthy',
      uptime: process.uptime(),
      databases: {
        tracking: { status: 'error' },
      },
      timestamp: Date.now(),
    });
  }
}

// ✅ Wrap with error handling middleware
export default withErrorHandler(handler);
