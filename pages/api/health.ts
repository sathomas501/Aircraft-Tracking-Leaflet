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
    };
  };
  timestamp: number;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthResponse>
) {
  try {
    // Get tracking database status
    const trackingDb = TrackingDatabaseManager.getInstance();
    await trackingDb.initializeDatabase();
    const trackingDbState = await trackingDb.getDatabaseState();

    const response: HealthResponse = {
      status: 'healthy',
      uptime: process.uptime(),
      databases: {
        tracking: {
          status: trackingDbState.isReady ? 'connected' : 'disconnected',
          tables: trackingDbState.tables,
          cacheStatus: trackingDbState.cacheStatus,
        },
      },
      timestamp: Date.now(),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Health check failed:', error);
    throw APIErrors.Internal(
      new Error(error instanceof Error ? error.message : 'Health check failed')
    );
  }
}

export default withErrorHandler(handler);
