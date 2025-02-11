import type { NextApiRequest, NextApiResponse } from 'next';
import databaseManager from '@/lib/db/databaseManager';
import {
  errorHandler,
  ErrorType,
  OpenSkyError,
  OpenSkyErrorCode,
} from '@/lib/services/error-handler';
import { API_CONFIG } from '@/config/api';
import { aircraftPositionService } from '@/lib/services/aircraft-position-service';
import { Aircraft, OpenSkyStateArray } from '@/types/base';

interface IcaoResponse {
  success: boolean;
  message: string;
  data: {
    manufacturer: string;
    icao24List: string[];
    states: Aircraft[];
    meta: {
      total: number;
      timestamp: string;
      batches: number;
    };
  };
  error?: string;
  errorType?: ErrorType;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<IcaoResponse>
) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
      data: getEmptyResponseData(),
      errorType: ErrorType.VALIDATION,
    });
  }

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

    // Get ICAO24 codes for the manufacturer
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

    const results: { icao24: string }[] = await databaseManager
      .executeQuery(query, [manufacturer])
      .catch((error) => {
        console.error('[icao24s] Database query error:', error);
        errorHandler.handleError(
          ErrorType.DATA,
          'Failed to query database',
          error
        );
        throw new OpenSkyError(
          'Failed to retrieve aircraft data',
          OpenSkyErrorCode.INVALID_DATA,
          500
        );
      });

    if (!results || results.length === 0) {
      console.warn(
        `[icao24s] No aircraft found for manufacturer: ${manufacturer}`
      );
      return res.status(200).json({
        success: true,
        message: `No aircraft found for manufacturer: ${manufacturer}`,
        data: getEmptyResponseData(),
      });
    }

    const icao24List = results.map((item) => item.icao24.toLowerCase());

    // Get current states from OpenSky
    let aircraftStates: Aircraft[] = [];

    try {
      console.log('[icao24s] Fetching positions for manufacturer:', {
        manufacturer,
        icaoCount: icao24List.length,
        sample: icao24List.slice(0, 3),
      });

      aircraftStates =
        await aircraftPositionService.getPositionsForIcao24s(icao24List);

      if (aircraftStates.length === 0) {
        console.log(
          '[icao24s] No active aircraft found for manufacturer:',
          manufacturer
        );
        return res.status(200).json({
          success: true,
          message: `No active aircraft found for ${manufacturer}`,
          data: {
            ...getEmptyResponseData(),
            manufacturer,
            icao24List,
          },
        });
      }

      // Add tracking update
      try {
        console.log('[icao24s] Updating tracking data', {
          count: aircraftStates.length,
          sample: aircraftStates[0].icao24,
        });

        const trackingResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/aircraft/tracking`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'updatePositions',
              positions: aircraftStates,
            }),
          }
        );

        if (!trackingResponse.ok) {
          console.warn('[icao24s] Tracking update failed:', {
            status: trackingResponse.status,
            statusText: trackingResponse.statusText,
          });
        }
      } catch (trackingError) {
        console.error('[icao24s] Tracking update error:', trackingError);
        // Don't throw here, continue with the response
      }
    } catch (error) {
      if (
        error instanceof OpenSkyError &&
        error.code === OpenSkyErrorCode.RATE_LIMIT
      ) {
        throw error; // Propagate rate limit errors
      }

      console.error('[icao24s] Position fetch error:', {
        error,
        manufacturer,
        icaoCount: icao24List.length,
      });

      throw new OpenSkyError(
        'Failed to fetch current aircraft states',
        OpenSkyErrorCode.POLLING_ERROR,
        503,
        { originalError: error }
      );
    }

    console.log('[icao24s] States fetched:', {
      icao24List,
      states: aircraftStates.map((state: Aircraft) => ({
        icao: state.icao24,
        lat: state.latitude,
        lon: state.longitude,
      })),
    });

    const response: IcaoResponse = {
      success: true,
      message: `Found ${aircraftStates.length} active aircraft for ${manufacturer}`,
      data: {
        manufacturer,
        icao24List,
        states: aircraftStates,
        meta: {
          total: icao24List.length,
          timestamp: new Date().toISOString(),
          batches: Math.ceil(
            icao24List.length / API_CONFIG.PARAMS.MAX_ICAO_QUERY
          ),
        },
      },
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('❌ [API] Error:', error);
    return handleApiError(error, res);
  }
}

function getEmptyResponseData() {
  return {
    manufacturer: '',
    icao24List: [],
    states: [],
    meta: {
      total: 0,
      timestamp: new Date().toISOString(),
      batches: 0,
    },
  };
}

function handleApiError(error: unknown, res: NextApiResponse<IcaoResponse>) {
  if (error instanceof OpenSkyError) {
    const errorType = getErrorTypeFromCode(error.code);
    errorHandler.handleError(errorType, error.message, error.context);

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      data: getEmptyResponseData(),
      error: error.message,
      errorType,
    });
    return;
  }

  // Handle unexpected errors
  errorHandler.handleError(
    ErrorType.OPENSKY_SERVICE,
    'Unexpected error occurred',
    error
  );

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    data: getEmptyResponseData(),
    error: error instanceof Error ? error.message : 'Unknown error',
    errorType: ErrorType.OPENSKY_SERVICE,
  });
}

function getErrorTypeFromCode(code: OpenSkyErrorCode): ErrorType {
  const errorMap: Record<OpenSkyErrorCode, ErrorType> = {
    [OpenSkyErrorCode.AUTHENTICATION]: ErrorType.OPENSKY_AUTH,
    [OpenSkyErrorCode.RATE_LIMIT]: ErrorType.OPENSKY_RATE_LIMIT,
    [OpenSkyErrorCode.TIMEOUT]: ErrorType.OPENSKY_TIMEOUT,
    [OpenSkyErrorCode.INVALID_DATA]: ErrorType.OPENSKY_DATA,
    [OpenSkyErrorCode.INVALID_REQUEST]: ErrorType.OPENSKY_REQUEST,
    [OpenSkyErrorCode.POLLING_ERROR]: ErrorType.OPENSKY_POLLING,
    [OpenSkyErrorCode.CLEANUP_ERROR]: ErrorType.OPENSKY_CLEANUP,
    [OpenSkyErrorCode.NETWORK]: ErrorType.NETWORK,
    [OpenSkyErrorCode.VALIDATION]: ErrorType.VALIDATION,
    [OpenSkyErrorCode.WEBSOCKET]: ErrorType.WEBSOCKET,
    [OpenSkyErrorCode.UNKNOWN_ERROR]: ErrorType.OPENSKY_SERVICE,
    [OpenSkyErrorCode.AUTHENTICATION_FAILED]: ErrorType.OPENSKY_AUTH,
    [OpenSkyErrorCode.RATE_LIMIT_EXCEEDED]: ErrorType.OPENSKY_RATE_LIMIT,
  };

  return errorMap[code] || ErrorType.OPENSKY_SERVICE;
}
