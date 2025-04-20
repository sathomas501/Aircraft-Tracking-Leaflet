// pages/api/tracking/manufacturer-region-count.ts
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

  const { REGION, MANUFACTURER } = req.query;

  if (!MANUFACTURER) {
    return res.status(400).json({ error: 'Missing MANUFACTURER parameter' });
  }

  try {
    let logMsg = `[API] Getting count for MANUFACTURER ${MANUFACTURER}`;
    logMsg += REGION ? ` in REGION ${REGION}` : ' globally';
    console.log(logMsg);

    let query = 'SELECT COUNT(*) as count FROM aircraft WHERE MANUFACTURER = ?';
    let params: any[] = [MANUFACTURER];
    let cacheKey = `MANUFACTURER-count-${MANUFACTURER}`;

    // If region is provided, add it to the query
    if (REGION) {
      const regionCode = parseInt(REGION as string, 10);

      // Validate region code
      if (isNaN(regionCode)) {
        return res.status(400).json({ error: 'Invalid region code' });
      }

      query += ' AND REGION = ?';
      params.push(regionCode);
      cacheKey += `-REGION-${regionCode}`;
    }

    // Execute query with 5 minute cache
    const result = await dbManager.query<{ count: number }>(
      cacheKey,
      query,
      params,
      300 // 5 minutes cache
    );

    // Get the count from the result
    const count = result.length > 0 ? result[0].count : 0;

    console.log(
      `[API] Found ${count} ${MANUFACTURER} aircraft ${REGION ? `in REGION ${REGION}` : 'globally'}`
    );

    res.status(200).json({
      MANUFACTURER: MANUFACTURER,
      REGION: REGION || 'global',
      count: count,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Error getting manufacturer count by region:', error);
    res
      .status(500)
      .json({ error: 'Failed to get manufacturer count by region' });
  }
}
