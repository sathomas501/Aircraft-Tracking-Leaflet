// pages/api/aircraft/icao24s.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import staticDatabaseManager from '@/lib/db/managers/staticDatabaseManager';

interface IcaoResponse {
  success: boolean;
  data?: {
    icao24List: string[];
  };
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<IcaoResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Please use POST.',
    });
  }

  try {
    const { manufacturer } = req.body;

    if (!manufacturer || typeof manufacturer !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Manufacturer is required and must be a string',
      });
    }

    // Validate manufacturer before fetching ICAO24s
    const isValid =
      await staticDatabaseManager.validateManufacturer(manufacturer);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: `Invalid manufacturer: ${manufacturer}`,
      });
    }

    console.log(`[API] Fetching ICAO24s for manufacturer: ${manufacturer}`);
    const icao24List =
      await staticDatabaseManager.getManufacturerIcao24s(manufacturer);

    console.log(`[API] Found ${icao24List.length} ICAO24s for ${manufacturer}`);
    return res.status(200).json({
      success: true,
      data: {
        icao24List,
      },
    });
  } catch (error) {
    console.error('[API] Error processing ICAO24s request:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
