// pages/api/tracking/icao24s.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import dbManager from '../../../lib/db/DatabaseManager';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Check database connection
    await dbManager.initialize();
  } catch (error) {
    console.error('[API] Error initializing database:', error);
    return res.status(500).json({ error: 'Failed to initialize database' });
  }

  const { manufacturer, region } = req.body;

  if (!manufacturer) {
    return res.status(400).json({ error: 'Missing manufacturer parameter' });
  }

  try {
    // Get ICAO24 codes from database
    const ICAO24s = await dbManager.getIcao24sForManufacturer(
      manufacturer,
      region
    );

    res.status(200).json({
      manufacturer,
      region: region || 'global',
      ICAO24s,
      count: ICAO24s.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Error getting ICAO24s:', error);
    res.status(500).json({ error: 'Failed to get ICAO24s' });
  }
}
