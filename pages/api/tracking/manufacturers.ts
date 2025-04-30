// pages/api/aircraft/tracking/manufacturers.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import dbManager from '../../../lib/db/DatabaseManager';
import { RegionCode } from '@/types/base';

// Optional: bounding boxes (for future use)
const regionBounds: Record<number, [number, number, number, number]> = {
  [RegionCode.Middle_East]: [12.0, 37.5, 34.0, 58.0],
  [RegionCode.Africa]: [-35.0, 37.0, -20.0, 52.0],
  [RegionCode.Asia]: [1.0, 81.0, 25.0, 180.0],
  [RegionCode.North_America]: [10, -170, 72, -50],
  [RegionCode.South_America]: [-56, -82, 13, -30],
  [RegionCode.Oceania]: [-50, 110, 0, 180],
  [RegionCode.Europe]: [35, -25, 70, 45],
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

    const regionParam = req.query.region;
    const region =
      regionParam !== undefined ? parseInt(regionParam as string, 10) : null;

    // 🟡 If region is missing or invalid
    if (region === null || isNaN(region)) {
      console.log(
        '[API] Invalid or missing region. Returning top global manufacturers'
      );
      const manufacturers = await dbManager.query(
        `manufacturers-global`,
        `
          SELECT MANUFACTURER AS name, COUNT(*) AS count
          FROM aircraft
          WHERE MANUFACTURER IS NOT NULL
          GROUP BY MANUFACTURER
          ORDER BY count DESC
          LIMIT 75
        `,
        [],
        0
      );

      return res.status(200).json(
        manufacturers.map((m: any) => ({
          value: m.name,
          label: `${m.name} (${m.count})`,
        }))
      );
    }

    // ✅ Region is valid (including 0)
    console.log(`[API] Region filter detected: ${region}`);

    const manufacturers = await dbManager.query(
      `manufacturers-region-${region}`,
      `
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
      [region],
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
