// pages/api/aircraft/ICAO24s.ts
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

  const { MANUFACTURER } = req.body;
  if (!MANUFACTURER) {
    return res.status(400).json({ error: 'Missing MANUFACTURER' });
  }

  try {
    console.log(`[API] Fetching ICAO24s for ${MANUFACTURER}`);

    // Fetch ICAO24s with batching to avoid SQLite errors
    const ICAO24s =
      await IcaoManagementService.getIcao24sForManufacturer(MANUFACTURER);

    res.status(200).json({
      ICAO24s,
      MANUFACTURER,
      count: ICAO24s.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Error fetching ICAO24s:', error);
    res.status(500).json({ error: 'Failed to fetch ICAO24s' });
  }
}
