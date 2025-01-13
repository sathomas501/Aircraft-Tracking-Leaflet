// pages/api/aircraft/models.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/db/connection';
import { getActiveDb } from '@/lib/db/activeConnection';
import type { SelectOption } from '@/types/base';
import type { ModelsResponse } from '@/types/api/api';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ModelsResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only GET requests are allowed'
    });
  }

  const { manufacturer } = req.query;

  if (!manufacturer || typeof manufacturer !== 'string') {
    return res.status(400).json({ 
      error: 'Missing manufacturer',
      message: 'Manufacturer parameter is required'
    });
  }

  console.log(`Models API Request for manufacturer: ${manufacturer}`);

  try {
    const mainDb = await getDb();
    const activeDb = await getActiveDb();

    // First, get active models count for this manufacturer
    const activeQuery = `
      SELECT COUNT(DISTINCT a.icao24) as active_count, a.model
      FROM aircraft a
      INNER JOIN (
        SELECT icao24
        FROM active_aircraft
        WHERE last_contact >= unixepoch('now') - 7200
      ) act ON a.icao24 = act.icao24
      WHERE a.manufacturer = ?
      GROUP BY a.model
    `;

    const activeResults = await mainDb.all(activeQuery, [manufacturer]);
    const activeCountMap = new Map(
      activeResults.map(row => [row.model, row.active_count])
    );

    // Then get total counts for models
    const query = `
      SELECT 
        model AS value,
        model AS label,
        COUNT(*) AS count
      FROM aircraft
      WHERE 
        manufacturer = ?
        AND model IS NOT NULL
        AND model != ''
        AND LENGTH(TRIM(model)) >= 2
        AND icao24 IS NOT NULL
        AND LENGTH(TRIM(icao24)) > 0
      GROUP BY model
      HAVING COUNT(*) > 0
      ORDER BY COUNT(*) DESC, model ASC;
    `;

    const models = await mainDb.all<SelectOption[]>(query, [manufacturer]);

    // Combine the results
    const response = models.map(m => ({
      ...m,
      count: Number(m.count) || 0,
      activeCount: Number(activeCountMap.get(m.value)) || 0
    }));

    // Sort by active count, then total count
    response.sort((a, b) => {
      if (b.activeCount !== a.activeCount) {
        return b.activeCount - a.activeCount;
      }
      return b.count - a.count;
    });

    return res.status(200).json({ models: response });

  } catch (error) {
    console.error('Error fetching models:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch models',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
}