// pages/api/aircraft/icao24s.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import IcaoManagementService from '../../../lib/services/IcaoManagementService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Allow only POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { manufacturer } = req.body;
  if (!manufacturer) {
    return res.status(400).json({ error: 'Missing manufacturer' });
  }

  try {
    console.log(`[API] Fetching ICAO24s for ${manufacturer}`);

    // Fetch ICAO24s with batching to avoid SQLite errors
    const icao24s = await IcaoManagementService.getIcao24sForManufacturer(manufacturer);

    res.status(200).json({
      icao24s,
      manufacturer,
      count: icao24s.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Error fetching ICAO24s:', error);
    res.status(500).json({ error: 'Failed to fetch ICAO24s' });
  }
}
