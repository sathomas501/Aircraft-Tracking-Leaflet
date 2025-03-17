// pages/api/aircraft/icao24s.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { StaticDatabaseManager } from '../../../lib/db/managers/staticDatabaseManager'; // Ensure correct import

interface Icao24Response {
  icao24List: string[];
  meta?: {
    total: number;
    manufacturer: string;
    model?: string;
    timestamp: string;
  };
  error?: string;
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Icao24Response>
) {
  console.log('ICAO24s endpoint called with:', {
    method: req.method,
    body: req.body,
    query: req.query,
  });

  try {
    // Extract manufacturer parameter
    const manufacturer =
      req.method === 'POST'
        ? req.body.manufacturer
        : (req.query.manufacturer as string);

    console.log('Extracted manufacturer:', manufacturer);

    if (!manufacturer) {
      console.log('No manufacturer provided');
      return res.status(400).json({
        icao24List: [],
        error: 'Manufacturer parameter required',
        message: 'Request body or query must include manufacturer',
      });
    }

    // ✅ Get database instance properly
    const db = await StaticDatabaseManager.getInstance(); // Await resolves the Promise

    const query = `
        SELECT DISTINCT icao24
        FROM aircraft
        WHERE manufacturer = ?
        AND icao24 IS NOT NULL
        AND icao24 != ''
        LIMIT 2000
    `;

    console.log('Executing query:', { query, params: [manufacturer] });

    // ✅ Ensure correct method is used for querying
    const results: { icao24: string }[] = await db.executeQuery(query, [
      manufacturer,
    ]);

    // ✅ Extract icao24 values from query results
    const icao24List = results.map((item) => item.icao24);

    return res.status(200).json({
      icao24List,
      meta: {
        total: results.length,
        manufacturer,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[API] Database error:', error);
    return res.status(500).json({
      icao24List: [],
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
