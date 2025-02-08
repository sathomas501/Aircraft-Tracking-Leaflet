// pages/api/aircraft/byManufacturer.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { DatabaseManager } from '@/lib/db/databaseManager';
import type { Aircraft } from '@/types/base';

interface AircraftResponse {
  aircraft: Aircraft[];
  icao24s: string[];
  error?: string;
  message?: string;
}

const requestCache = new Set<string>();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AircraftResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      aircraft: [],
      icao24s: [],
      error: 'Method not allowed',
    });
  }

  const { manufacturer } = req.body;
  if (!manufacturer) {
    return res.status(400).json({
      aircraft: [],
      icao24s: [],
      error: 'Manufacturer is required',
    });
  }

  if (requestCache.has(manufacturer)) {
    return res.status(429).json({
      aircraft: [],
      icao24s: [],
      error: 'Request in progress',
    });
  }

  requestCache.add(manufacturer);
  const db = DatabaseManager.getInstance();
  await db.initializeDatabase();

  try {
    console.time(`[Aircraft] Fetching aircraft for ${manufacturer}`);

    const aircraft = await db.executeQuery<Aircraft>(
      `
      SELECT 
        icao24,
        "N-NUMBER",
        manufacturer,
        model,
        operator,
        NAME,
        CITY,
        STATE,
        TYPE_AIRCRAFT,
        OWNER_TYPE
      FROM aircraft 
      WHERE manufacturer = ? 
      ORDER BY model;
    `,
      [manufacturer]
    );

    console.timeEnd(`[Aircraft] Fetching aircraft for ${manufacturer}`);

    const icao24s = aircraft.map((a) => a.icao24);
    requestCache.delete(manufacturer); // ✅ Ensures requests aren't locked

    console.log(
      `[Aircraft] Found ${aircraft.length} aircraft for ${manufacturer}`
    );
    return res.status(200).json({
      aircraft,
      icao24s,
      message: `Found ${aircraft.length} aircraft`,
    });
  } catch (error) {
    console.error('[Aircraft] Database error:', error);
    return res.status(500).json({
      aircraft: [],
      icao24s: [],
      error: 'Failed to fetch aircraft',
    });
  } finally {
    requestCache.delete(manufacturer); // ✅ Always remove from cache
  }
}
