import type { NextApiRequest, NextApiResponse } from 'next';
import BackendDatabaseManager from '@/lib/db/backendDatabaseManager';
import {
  errorHandler,
  ErrorType,
} from '@/lib/services/error-handler/error-handler';

interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  message: string;
  timestamp: string;
  error?: unknown;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthResponse>
) {
  console.log('[Health] 🏥 Health check accessed');

  try {
    const db = await BackendDatabaseManager.getInstance();

    // Run a simple query to verify the database connection
    await db.executeQuery('SELECT 1');

    const response: HealthResponse = {
      status: 'healthy',
      message: 'Database connection successful',
      timestamp: new Date().toISOString(),
    };

    console.log('[Health] ✅ Health check passed');
    res.status(200).json(response);
  } catch (error) {
    console.error('[Health] ❌ Health check failed:', error);

    // Log the error with the error handler
    if (error instanceof Error) {
      errorHandler.handleError(ErrorType.CRITICAL, error);
    } else {
      errorHandler.handleError(
        ErrorType.CRITICAL,
        new Error('Database health check failed')
      );
    }

    const response: HealthResponse = {
      status: 'unhealthy',
      message: 'Database connection failed',
      timestamp: new Date().toISOString(),
      error: process.env.NODE_ENV === 'development' ? error : undefined,
    };

    res.status(503).json(response);
  }
}
