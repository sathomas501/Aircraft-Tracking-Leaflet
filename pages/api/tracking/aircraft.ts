// pages/api/lookup/aircraft.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import dbManager from '@/lib/db/DatabaseManager';

type ApiResponse = {
  success: boolean;
  aircraft?: any[];
  error?: string;
  count?: number;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // Only allow POST requests with ICAO24 codes
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, error: 'Method not allowed' });
  }

  try {
    // Extract ICAO24 codes from request body
    const { icao24s } = req.body;

    if (!Array.isArray(icao24s) || icao24s.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Request must include an array of ICAO24 codes',
      });
    }

    // Limit the number of codes in a single request to prevent abuse
    const MAX_ICAOS_PER_REQUEST = 200;
    if (icao24s.length > MAX_ICAOS_PER_REQUEST) {
      return res.status(400).json({
        success: false,
        error: `Too many ICAO24 codes in request. Maximum is ${MAX_ICAOS_PER_REQUEST}`,
      });
    }

    // Make sure DB manager is initialized
    await dbManager.initialize();

    // Fetch aircraft data from database
    const aircraft = await dbManager.getAircraftByIcao24s(icao24s);

    // Return success response
    return res.status(200).json({
      success: true,
      aircraft,
      count: aircraft.length,
    });
  } catch (error) {
    console.error('Error in aircraft lookup API:', error);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}
