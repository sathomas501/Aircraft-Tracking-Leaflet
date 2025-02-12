// icao24s.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import databaseManager from '@/lib/db/databaseManager';
import {
  errorHandler,
  ErrorType,
  OpenSkyError,
  OpenSkyErrorCode,
} from '../../../lib/services/error-handler/error-handler';
import { API_CONFIG } from '@/config/api';

interface IcaoResponse {
  success: boolean;
  message: string;
  data: {
    manufacturer: string;
    icao24List: string[];
    meta: {
      total: number;
      timestamp: string;
    };
  };
  error?: string;
  errorType?: ErrorType;
}

interface DatabaseIcaoResult {
  icao24: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<IcaoResponse>
) {
  try {
    const manufacturer =
      req.method === 'POST'
        ? req.body.manufacturer
        : (req.query.manufacturer as string);

    if (!manufacturer) {
      throw new OpenSkyError(
        'Manufacturer parameter is required',
        OpenSkyErrorCode.VALIDATION,
        400
      );
    }

    await databaseManager.initializeDatabase();

    // Define the query string
    const query = `
      SELECT DISTINCT icao24
      FROM aircraft
      WHERE manufacturer = ?
      AND icao24 IS NOT NULL
      AND icao24 != ''
      AND LENGTH(icao24) = 6
      AND LOWER(icao24) GLOB '[0-9a-f]*'
      LIMIT ${API_CONFIG.PARAMS.MAX_TOTAL_ICAO_QUERY}
    `;

    console.log('[icao24s] Querying database for manufacturer:', manufacturer);

    const results = await databaseManager
      .executeQuery<DatabaseIcaoResult>(query, [manufacturer])
      .catch((error) => {
        console.error('[icao24s] Database query error:', error);
        throw new OpenSkyError(
          'Failed to retrieve aircraft data',
          OpenSkyErrorCode.INVALID_DATA,
          500,
          error
        );
      });

    if (!results || !Array.isArray(results)) {
      throw new OpenSkyError(
        'Invalid database response format',
        OpenSkyErrorCode.INVALID_DATA,
        500
      );
    }

    const icao24List = results
      .filter((item) => item && typeof item.icao24 === 'string')
      .map((item) => item.icao24.toLowerCase());

    if (icao24List.length === 0) {
      return res.status(200).json({
        success: true,
        message: `No valid aircraft found for manufacturer: ${manufacturer}`,
        data: getEmptyResponseData(),
      });
    }

    console.log('[icao24s] Found aircraft:', {
      manufacturer,
      count: icao24List.length,
      sample: icao24List.slice(0, 3),
    });

    return res.status(200).json({
      success: true,
      message: `Found ${icao24List.length} aircraft for ${manufacturer}`,
      data: {
        manufacturer,
        icao24List,
        meta: {
          total: icao24List.length,
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('❌ [API] Error:', error);
    return handleApiError(error, res);
  }
}

function getEmptyResponseData() {
  return {
    manufacturer: '',
    icao24List: [],
    meta: {
      total: 0,
      timestamp: new Date().toISOString(),
    },
  };
}

function handleApiError(error: unknown, res: NextApiResponse<IcaoResponse>) {
  if (error instanceof OpenSkyError) {
    errorHandler.handleError(ErrorType.OPENSKY_SERVICE, error.message, {
      code: error.code,
      status: error.statusCode,
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      data: getEmptyResponseData(),
      error: error.message,
      errorType: ErrorType.OPENSKY_SERVICE,
    });
  }

  const message =
    error instanceof Error ? error.message : 'Unexpected error occurred';

  errorHandler.handleError(ErrorType.OPENSKY_SERVICE, message, error);

  return res.status(500).json({
    success: false,
    message,
    data: getEmptyResponseData(),
    error: message,
    errorType: ErrorType.OPENSKY_SERVICE,
  });
}
