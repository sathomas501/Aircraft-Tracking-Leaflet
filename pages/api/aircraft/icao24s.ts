// pages/api/aircraft/icao24s.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import dbManager from '../../../lib/db/DatabaseManager';

interface Icao24Response {
  icao24s: string[];
  manufacturer: string;
  count: number;
  timestamp: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { manufacturer } = req.body;

  if (!manufacturer) {
    return res.status(400).json({
      error: 'Manufacturer parameter required',
    });
  }

  try {
    console.log(`[API] Fetching ICAO24s for ${manufacturer}`);

    // Get cached query for manufacturer's ICAO24 codes
    const cacheKey = `icao24s-${manufacturer}`;
    const query = `
      SELECT DISTINCT icao24
      FROM aircraft
      WHERE manufacturer = ?
      AND icao24 IS NOT NULL AND icao24 != ''
      AND LENGTH(icao24) = 6
      AND LOWER(icao24) GLOB '[0-9a-f]*'
      ORDER BY icao24
    `;

    // Get ICAO codes from database with 10 minute cache
    const results = await dbManager.query<{ icao24: string }>(
      cacheKey,
      query,
      [manufacturer],
      600 // 10 minute cache
    );

    // Validate and format ICAO codes
    const icao24s = results
      .map((item) => item.icao24.toLowerCase())
      .filter((icao24) => /^[0-9a-f]{6}$/.test(icao24));

    // Also get all aircraft records for these ICAOs for the frontend
    const staticAircraftList = await dbManager.getAircraftByIcao24s(icao24s);

    console.log(
      `[API] Found ${icao24s.length} valid ICAO24s for ${manufacturer}`
    );

    return res.status(200).json({
      icao24s,
      staticAircraftList,
      manufacturer,
      count: icao24s.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Error fetching ICAO24s:', error);
    return res.status(500).json({
      error: 'Failed to fetch ICAO24s',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
