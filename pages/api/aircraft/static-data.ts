// pages/api/aircraft/static-data.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { APIErrors } from '@/lib/services/error-handler/api-error';
import {
  errorHandler,
  ErrorType,
} from '@/lib/services/error-handler/error-handler';
import databaseManager from '@/lib/db/databaseManager';
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
    // Ensure database is initialized
    await databaseManager.initializeDatabase();

    // Build query with proper parameter placeholders
    const placeholders = icao24s.map(() => '?').join(',');
    const query = `
      SELECT 
        icao24,
        "N-NUMBER",
        manufacturer,
        model,
        NAME,
        CITY,
        STATE,
        TYPE_AIRCRAFT,
        OWNER_TYPE
      FROM aircraft
      WHERE icao24 IN (${placeholders})
    `;

    console.log(
      `[Static Data API] 🔍 Fetching data for ${icao24s.length} aircraft`
    );

    const aircraft = await databaseManager.executeQuery<Aircraft>(
      query,
      icao24s
    );

    console.log(`[Static Data API] ✅ Found ${aircraft.length} aircraft`);

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
