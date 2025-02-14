import type { NextApiRequest, NextApiResponse } from 'next';
import databaseManager from '@/lib/db/databaseManager';
import {
  errorHandler,
  ErrorType,
  OpenSkyError,
  OpenSkyErrorCode,
} from '@/lib/services/error-handler/error-handler';
import { API_CONFIG } from '@/config/api';
import CacheManager from '@/lib/services/managers/cache-manager';

const cache = new CacheManager<string[]>(5 * 60); // 5-minute cache

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

    // Check cache first
    const cachedIcao24s = cache.get(manufacturer);
    if (cachedIcao24s) {
      console.log(`[icao24s] ✅ Returning cached ICAO24s for ${manufacturer}`);
      return res.status(200).json({
        success: true,
        message: `Retrieved cached ICAO24s for manufacturer: ${manufacturer}`,
        data: {
          manufacturer,
          icao24List: cachedIcao24s,
          meta: {
            total: cachedIcao24s.length,
            timestamp: new Date().toISOString(),
          },
        },
      });
    }

    await databaseManager.initializeDatabase();

    // Query ICAO24s from DB
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

    console.log(
      `[icao24s] Querying database for manufacturer: ${manufacturer}`
    );

    const results = await databaseManager.executeQuery<DatabaseIcaoResult>(
      query,
      [manufacturer]
    );

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

    // Cache the result
    cache.set(manufacturer, icao24List);

    console.log(
      `[icao24s] ✅ Cached ${icao24List.length} ICAOs for ${manufacturer}`
    );

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
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve aircraft data',
      data: {
        manufacturer: '',
        icao24List: [],
        meta: { total: 0, timestamp: new Date().toISOString() },
      },
      error: errorMessage, // ✅ Now TypeScript recognizes 'error' as a valid string
      errorType: ErrorType.OPENSKY_SERVICE,
    });
  }
}
