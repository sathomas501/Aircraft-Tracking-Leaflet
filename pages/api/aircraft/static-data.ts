// pages/api/aircraft/static-data.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { APIErrors } from '@/lib/services/error-handler/api-error';
import {
  errorHandler,
  ErrorType,
} from '@/lib/services/error-handler/error-handler';
import databaseManager from '@/lib/db/managers/staticDatabaseManager';
import { Aircraft } from '@/types/base';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    throw APIErrors.BadRequest('Method not allowed');
  }

  const { icao24s } = req.body;

  if (!Array.isArray(icao24s) || icao24s.length === 0) {
    throw APIErrors.BadRequest('Invalid ICAO24 list');
  }

  try {
    console.log(
      `[Static Data API] 🔍 Fetching data for ${icao24s.length} aircraft`
    );
    const aircraft = await databaseManager.getAircraftByIcao24s(icao24s);

    return res.status(200).json({
      success: true,
      aircraft,
    });
  } catch (error) {
    console.error('[Static Data API] ❌ Error:', error);

    errorHandler.handleError(
      ErrorType.OPENSKY_SERVICE,
      error instanceof Error
        ? error
        : new Error('Failed to fetch static aircraft data')
    );

    throw error;
  }
}

export default withErrorHandler(handler);
