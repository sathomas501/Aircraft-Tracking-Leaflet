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

  const {
    REGION,
    MANUFACTURER,
    ICAO24s,
    includeStatic = false,
    activeOnly = false,
  } = req.body;
  if (!REGION || !MANUFACTURER) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  console.log(
    `[API] Received request for ${ICAO24s?.length || 0} aircraft from ${MANUFACTURER || 'unknown MANUFACTURER'}||REGION: ${REGION}`
  );
  console.log(`[API] Static data inclusion: ${includeStatic ? 'Yes' : 'No'}`);

  if (!ICAO24s || !Array.isArray(ICAO24s) || ICAO24s.length === 0) {
    console.log('[API] Invalid request: Missing or empty ICAO24s array');
    return res.status(400).json({
      error: 'Valid ICAO24s array required',
    });
  }

  try {
    console.log(`[API] Fetching ICAO24s for ${MANUFACTURER}`);

    // Fetch ICAO24s with batching to avoid SQLite errors
    const ICAO24s =
      await IcaoManagementService.getIcao24sForManufacturer(MANUFACTURER);

    console.log(
      `[API] Received request for ${ICAO24s?.length || 0} aircraft from ${MANUFACTURER || 'unknown MANUFACTURER'}||REGION: ${REGION}`
    );
    console.log(`[API] Static data inclusion: ${includeStatic ? 'Yes' : 'No'}`);

    // Show a sample of 5 ICAOs in the request
    const sampleIcaos = ICAO24s.slice(0, 5);
    console.log(
      `[API] Sample ICAOs in request: ${sampleIcaos.join(', ')}${ICAO24s.length > 5 ? '...' : ''}`
    );

    // Convert string query parameter to numeric region code
    const regionCode = parseInt(REGION as string, 10);

    // Define valid region codes
    const validRegionCodes = [0, 1, 2, 3, 4, 5, 6, 7]; // Example region codes

    // Validate region code
    if (isNaN(regionCode) || !validRegionCodes.includes(regionCode)) {
      return res.status(400).json({ error: 'Invalid region code' });
    }

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
