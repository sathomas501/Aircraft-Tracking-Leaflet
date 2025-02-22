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
    const [trackingDbState, connectionCheck] = await Promise.all([
      trackingDb.getDatabaseState(),
      trackingDb.checkConnection(),
    ]);

    // Determine overall status
    const hasRequiredTables =
      trackingDbState.tables.includes('tracked_aircraft');
    const isHealthy =
      connectionCheck && hasRequiredTables && trackingDbState.isReady;

    const response: HealthResponse = {
      status: isHealthy ? 'healthy' : 'degraded',
      uptime: process.uptime(),
      databases: {
        tracking: {
          status: trackingDbState.isReady ? 'connected' : 'disconnected',
          tables: trackingDbState.tables,
          cacheStatus: trackingDbState.cacheStatus,
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
