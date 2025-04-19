// pages/api/tracking/region-count.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import dbManager from '../../../lib/db/DatabaseManager';
import { RegionCode } from '../../../types/base';

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

  if (!region) {
    return res.status(400).json({ error: 'Missing region parameter' });
  }

  // Convert string query parameter to numeric region code
  const regionCode = parseInt(region as string, 10);

  // Validate region code
  if (isNaN(regionCode) || !Object.values(RegionCode).includes(regionCode)) {
    return res.status(400).json({ error: 'Invalid region code' });
  }

  try {
    console.log(`[API] Getting count for region ${region}`);

    const cacheKey = `region-count-${regionCode}`;
    const result = await dbManager.query<{ count: number }>(
      cacheKey,
      'SELECT COUNT(*) as count FROM aircraft WHERE REGION = ?',
      [regionCode]
    );

    // Get the count from the result
    const count = result.length > 0 ? result[0].count : 0;

    res.status(200).json({
      region: region,
      count: count,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Error getting region count:', error);
    res.status(500).json({ error: 'Failed to get region count' });
  }
}
