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
  // Add other fields as needed
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

  // Allow only GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { region } = req.query;
  if (region === undefined) {
    return res.status(400).json({ error: 'Missing region parameter' });
  }

  // Convert string query parameter to numeric region code
  const regionCode = parseInt(region as string, 10);

  // Validate region code
  if (isNaN(regionCode) || !Object.values(RegionCode).includes(regionCode)) {
    return res.status(400).json({ error: 'Invalid region code' });
  }

  try {
    console.log(`[API] Fetching aircraft for region ${region}`);

    // Execute query
    const aircraftData: any[] = await new Promise((resolve, reject) => {
      dbManager
        .query(
          `aircraft-region-${regionCode}`, // Unique cache key
          'SELECT * FROM aircraft WHERE REGION = ?',
          [regionCode]
        )
        .then(resolve)
        .catch(reject);
    });

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
dbManager;
