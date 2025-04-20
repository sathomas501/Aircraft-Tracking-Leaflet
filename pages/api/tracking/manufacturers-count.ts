// pages/api/tracking/manufacturers-count.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import dbManager from '../../../lib/db/DatabaseManager';
import { RegionCode } from '@/types/base';

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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { region } = req.query;

  try {
    console.log(
      `[API] Total count of manufacturers ${region ? `in region ${region}` : 'globally'}`
    );

    let query = `
      SELECT MANUFACTURER, COUNT(*) as count 
      FROM aircraft 
      WHERE MANUFACTURER IS NOT NULL AND MANUFACTURER != ''
    `;

    let params: any[] = [];
    let cacheKey = 'manufacturers-count';

    // If region is provided, add it to the query
    if (region) {
      const regionCode = parseInt(region as string, 10);

      // Validate region code
      if (isNaN(regionCode)) {
        return res.status(400).json({ error: 'Invalid region code' });
      }

      query += ' AND REGION = ?';
      params.push(regionCode);
      cacheKey += `-region-${regionCode}`;
    }

    // Group by manufacturer and order by count
    query += ' GROUP BY MANUFACTURER ORDER BY count DESC';

    const result = await dbManager.query<{
      MANUFACTURER: string;
      count: number;
    }>(
      cacheKey,
      query,
      params,
      300 // 5 minutes cache
    );

    // Transform the result to the expected format
    const manufacturers = result.map((item) => ({
      manufacturer: item.MANUFACTURER,
      count: item.count,
    }));

    console.log(
      `[API] Found ${manufacturers.length} manufacturers ${region ? `in region ${region}` : 'globally'}`
    );

    res.status(200).json({
      region: region || 'global',
      manufacturers: manufacturers,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Error getting manufacturer counts:', error);
    res.status(500).json({ error: 'Failed to get manufacturer counts' });
  }
}
