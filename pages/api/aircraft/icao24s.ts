import type { NextApiRequest, NextApiResponse } from 'next';
import databaseManager from '@/lib/db/databaseManager'; // ✅ Correct import

interface Icao24Response {
  success: boolean;
  message: string;
  data: {
    icao24List: string[];
    meta: {
      total: number;
      manufacturer: string;
      timestamp: string;
    };
  };
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Icao24Response>
) {
  console.log('📡 [API] ICAO24s endpoint called:', {
    method: req.method,
    body: req.body,
    query: req.query,
  });

  try {
    const manufacturer =
      req.method === 'POST'
        ? req.body.manufacturer
        : (req.query.manufacturer as string);

    if (!manufacturer) {
      console.warn('⚠️ [API] No manufacturer provided');
      return res.status(400).json({
        success: false,
        message: 'Manufacturer query parameter is required',
        data: {
          icao24List: [],
          meta: {
            total: 0,
            manufacturer: '',
            timestamp: new Date().toISOString(),
          },
        },
        error: 'Missing manufacturer parameter',
      });
    }

    console.log(`🔍 [API] Fetching ICAO24s for manufacturer: ${manufacturer}`);

    // ✅ Ensure Database is initialized
    await databaseManager.initializeDatabase();

    const query = `
            SELECT DISTINCT icao24
            FROM aircraft
            WHERE manufacturer = ?
            AND icao24 IS NOT NULL
            AND icao24 != ''
            LIMIT 2000
        `;

    console.time(`[API] ICAO24 Query Execution`); // ✅ Measure execution time
    const results: { icao24: string }[] = await databaseManager.executeQuery(
      query,
      [manufacturer]
    );
    console.timeEnd(`[API] ICAO24 Query Execution`);

    const icao24List = results.map((item) => item.icao24);

    return res.status(200).json({
      success: true,
      message: `Found ${results.length} ICAO24 codes for ${manufacturer}`,
      data: {
        icao24List,
        meta: {
          total: results.length,
          manufacturer,
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('❌ [API] Database error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      data: {
        icao24List: [],
        meta: {
          total: 0,
          manufacturer: '',
          timestamp: new Date().toISOString(),
        },
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
