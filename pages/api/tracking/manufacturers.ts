// pages/api/aircraft/tracking/manufacturers.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import dbManager from '../../../lib/db/DatabaseManager';
import { RegionCode } from '@/types/base';

// Optional: bounding boxes (for future use)
const regionBounds: Record<number, [number, number, number, number]> = {
  [RegionCode.MIDDLE_EAST]: [12.0, 37.5, 34.0, 58.0],
  [RegionCode.AFRICA]: [-35.0, 37.0, -20.0, 52.0],
  [RegionCode.ASIA]: [1.0, 81.0, 25.0, 180.0],
  [RegionCode.NORTH_AMERICA]: [10, -170, 72, -50],
  [RegionCode.SOUTH_AMERICA]: [-56, -82, 13, -30],
  [RegionCode.OCEANIA]: [-50, 110, 0, 180],
  [RegionCode.EUROPE]: [35, -25, 70, 45],
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[API] Manufacturers endpoint called with method:', req.method);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    await dbManager.initialize();

    // Parse and normalize region parameter
    const regionParam = req.query.region;
    const regionRaw =
      regionParam !== undefined ? parseInt(regionParam as string, 10) : NaN;
    const region = isNaN(regionRaw) || regionRaw <= 0 ? 1 : regionRaw;

    console.log(`[API] Region filter resolved to: ${region}`);

    // Use global query for region 1, otherwise region-specific
    const isGlobal = region === 1;

    const manufacturers = await dbManager.query(
      isGlobal ? `manufacturers-global` : `manufacturers-region-${region}`,
      isGlobal
        ? `
          SELECT MANUFACTURER AS name, COUNT(*) AS count
          FROM aircraft
          WHERE MANUFACTURER IS NOT NULL
          GROUP BY MANUFACTURER
          ORDER BY count DESC
          LIMIT 75
        `
        : `
          SELECT 
            MANUFACTURER AS name, 
            COUNT(*) AS count 
          FROM aircraft 
          WHERE MANUFACTURER IS NOT NULL AND REGION = ?
          GROUP BY MANUFACTURER 
          HAVING count > 0 
          ORDER BY count DESC 
          LIMIT 50
        `,
      isGlobal ? [] : [region],
      0
    );

    return res.status(200).json(
      manufacturers.map((m: any) => ({
        value: m.name,
        label: `${m.name} (${m.count})`,
      }))
    );
  } catch (error) {
    console.error('[API] Error in manufacturers endpoint:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
