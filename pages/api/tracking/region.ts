// pages/api/tracking/region.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import dbManager from '../../../lib/db/DatabaseManager';
import { RegionCode } from '../../../types/base';

interface AircraftRecord {
  ICAO24: string;
  REGISTRATION: string;
  MANUFACTURER: string;
  MODEL: string;
  REGION: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
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

  const { region } = req.query;

  if (!region || typeof region !== 'string') {
    return res
      .status(400)
      .json({ error: 'Missing or invalid region parameter' });
  }

  const parsed = parseInt(region, 10);
  const regionCode = Number.isNaN(parsed) ? null : (parsed as RegionCode);

  if (regionCode === null || !Object.values(RegionCode).includes(regionCode)) {
    return res.status(400).json({ error: 'Invalid region code' });
  }

  try {
    console.log(`[API] Fetching aircraft for region ${regionCode}`);

    const aircraftData: AircraftRecord[] = await dbManager.query(
      `aircraft-region-${regionCode}`,
      'SELECT * FROM aircraft WHERE REGION = ?',
      [regionCode]
    );

    res.status(200).json({
      aircraft: aircraftData,
      region: regionCode,
      count: aircraftData.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Error fetching aircraft by region:', error);
    res.status(500).json({ error: 'Failed to fetch aircraft by region' });
  }
}
