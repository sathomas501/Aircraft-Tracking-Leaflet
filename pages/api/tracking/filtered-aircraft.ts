// pages/api/tracking/filtered-aircraft.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import dbManager from '../../../lib/db/DatabaseManager';
import { RegionCode, Aircraft } from '@/types/base';

interface LiveDataResponse {
  aircraft: Array<{
    ICAO24: string;
    latitude?: number;
    longitude?: number;
    [key: string]: any;
  }>;
  count: number;
  timestamp: string;
}

interface StaticAircraft {
  ICAO24?: string;
  MANUFACTURER?: string;
  REGION?: number;
  [key: string]: any;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Check database connection first
    console.log('[API] Checking database connection...');
    await dbManager.initialize();
    console.log('[API] Database initialized successfully');
  } catch (error) {
    console.error('[API] Error initializing database:', error);
    return res.status(500).json({ error: 'Failed to initialize database' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { region, manufacturer, page = '1', limit = '500' } = req.query;

  if (!region || !manufacturer) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const pageNumber = parseInt(page as string, 10);
  const limitNumber = parseInt(limit as string, 10);
  const offset = (pageNumber - 1) * limitNumber;

  // Convert string query parameter to numeric region code
  const regionCode = parseInt(region as string, 10);

  // Validate region code
  const validRegionCodes = Object.values(RegionCode).filter(
    (code) => typeof code === 'number'
  );
  if (isNaN(regionCode) || !validRegionCodes.includes(regionCode)) {
    return res.status(400).json({ error: 'Invalid region code' });
  }

  try {
    console.log(
      `[API] Fetching aircraft for region ${region} and manufacturer ${manufacturer}`
    );

    // Get the total count first
    const countcacheKey = `aircraft-count-${regionCode}-${manufacturer}`;
    const countResult = await dbManager.query<{ count: number }>(
      countcacheKey,
      'SELECT COUNT(*) as count FROM aircraft WHERE REGION = ? AND MANUFACTURER = ?',
      [regionCode, manufacturer]
    );
    const totalCount = countResult.length > 0 ? countResult[0].count : 0;

    // Then get the paginated results with ICAO24s
    const datacacheKey = `aircraft-${regionCode}-${manufacturer}-${pageNumber}-${limitNumber}`;
    const staticAircraftData = await dbManager.query<StaticAircraft>(
      datacacheKey,
      'SELECT * FROM aircraft WHERE REGION = ? AND MANUFACTURER = ? LIMIT ? OFFSET ?',
      [regionCode, manufacturer, limitNumber, offset]
    );

    // Extract ICAO24s from the aircraft data
    const icao24s = staticAircraftData
      .filter((aircraft) => aircraft.ICAO24)
      .map((aircraft) => aircraft.ICAO24 as string);

    console.log(`[API] Found ${icao24s.length} ICAO24s for live data lookup`);

    if (icao24s.length === 0) {
      // No ICAO24s found, return static data only
      return res.status(200).json({
        aircraft: staticAircraftData,
        region: region,
        manufacturer: manufacturer,
        count: staticAircraftData.length,
        total: totalCount,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(totalCount / limitNumber),
        timestamp: new Date().toISOString(),
      });
    }

    // Call live.ts API to get position data
    // Get base URL from environment variable or use a default
    const baseUrl =
      process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

    const liveResponse = await fetch(`${baseUrl}/api/tracking/live`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ICAO24s: icao24s,
        MANUFACTURER: manufacturer,
        includeStatic: false, // We'll merge with our own static data
        activeOnly: false,
      }),
    });

    if (!liveResponse.ok) {
      console.error(
        `[API] Live tracking API error: ${liveResponse.status} ${liveResponse.statusText}`
      );

      // Fall back to static data if live API fails
      return res.status(200).json({
        aircraft: staticAircraftData,
        region: region,
        manufacturer: manufacturer,
        count: staticAircraftData.length,
        total: totalCount,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(totalCount / limitNumber),
        timestamp: new Date().toISOString(),
      });
    }

    const liveData = (await liveResponse.json()) as LiveDataResponse;
    console.log(
      `[API] Received ${liveData.aircraft?.length || 0} aircraft with position data`
    );

    // Create lookup map for live data
    const liveMap = liveData.aircraft.reduce<Record<string, any>>(
      (map, aircraft) => {
        if (aircraft.ICAO24) {
          map[aircraft.ICAO24.toLowerCase()] = aircraft;
        }
        return map;
      },
      {}
    );

    // Merge static data with live data
    const mergedAircraft = staticAircraftData.map((staticAircraft) => {
      const icao = staticAircraft.ICAO24?.toLowerCase() || '';
      const liveAircraft = liveMap[icao] || {};

      return {
        ...staticAircraft,
        ...liveAircraft,
        // Ensure consistent ICAO24 format
        ICAO24: icao,
        // Add tracking metadata
        _tracking: {
          REGION: regionCode,
          MANUFACTURER: manufacturer,
          lastSeen: Date.now(),
        },
      };
    });

    console.log(
      `[API] Returning ${mergedAircraft.length} merged aircraft records`
    );

    res.status(200).json({
      aircraft: mergedAircraft,
      region: region,
      manufacturer: manufacturer,
      count: mergedAircraft.length,
      total: totalCount,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(totalCount / limitNumber),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Error fetching filtered aircraft:', error);
    res.status(500).json({
      error: 'Failed to fetch filtered aircraft',
      message: error instanceof Error ? error.message : 'Unknown error',
      aircraft: [],
      count: 0,
      timestamp: new Date().toISOString(),
    });
  }
}
