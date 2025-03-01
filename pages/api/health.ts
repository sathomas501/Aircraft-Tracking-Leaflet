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
  if (req.method !== 'GET') {
    throw APIErrors.BadRequest('Method not allowed');
  }

  try {
    console.log('[HealthAPI] 🏥 Performing health check');

    // Get tracking database status
    const trackingDb = TrackingDatabaseManager.getInstance();

    // Initialize the database if needed
    await trackingDb.ensureInitialized();

    // Check if the database is ready
    const isDbReady = trackingDb.isReady;

    // Check connection by running a test query
    let connectionCheck = false;
    try {
      const testQuery = await trackingDb.executeQuery('SELECT 1 as test');
      connectionCheck =
        (testQuery as { test: number }[]).length > 0 &&
        (testQuery as { test: number }[])[0].test === 1;
    } catch (error) {
      console.error('[HealthAPI] Database connection check failed:', error);
      connectionCheck = false;
    }

    // Get the tables in the database
    let tables: string[] = [];
    try {
      const tableQuery = await trackingDb.executeQuery<{ name: string }>(`
        SELECT name FROM sqlite_master 
        WHERE type='table' 
        ORDER BY name
      `);
      tables = tableQuery.map((row) => row.name);
    } catch (error) {
      console.error('[HealthAPI] Failed to get database tables:', error);
      tables = [];
    }

    // Check for cache status - replace with appropriate method if available
    const cacheStatus = {
      manufacturersAge: null,
      icaosAge: null,
    };

    // Determine overall status
    const hasRequiredTables = tables.includes('tracked_aircraft');
    const isHealthy = connectionCheck && hasRequiredTables && isDbReady;

    const response: HealthResponse = {
      status: isHealthy ? 'healthy' : 'degraded',
      uptime: process.uptime(),
      databases: {
        tracking: {
          status: isDbReady ? 'connected' : 'disconnected',
          tables: tables,
          cacheStatus: cacheStatus,
          details: {
            hasRequiredTables,
            connectionCheck,
          },
        },
      },
      timestamp: Date.now(),
    };

    console.log('[HealthAPI] ✅ Health check complete:', {
      status: response.status,
      trackingDb: response.databases.tracking.status,
    });

    const statusCode = isHealthy ? 200 : 503;
    res.status(statusCode).json(response);
  } catch (error) {
    console.error('[HealthAPI] ❌ Health check failed:', error);
    throw APIErrors.Internal(
      error instanceof Error ? error : new Error('Health check failed')
    );
  }
}

export default withErrorHandler(handler);
