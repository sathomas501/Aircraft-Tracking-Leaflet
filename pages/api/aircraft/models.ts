// pages/api/aircraft/models.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase } from '@/lib/db/databaseManager';
import type { SelectOption } from '@/types/base';
import type { ModelsResponse } from '@/types/api/common/responses';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ModelsResponse>
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only GET and POST methods are supported'
    });
  }

  const manufacturer = req.method === 'GET' 
    ? req.query.manufacturer 
    : req.body.manufacturer;

  if (!manufacturer || typeof manufacturer !== 'string') {
    return res.status(400).json({ 
      error: 'Missing manufacturer',
      message: 'Manufacturer parameter is required'
    });
  }

  try {
    const db = await getDatabase();
    
    const query = `
      SELECT DISTINCT
        model AS value,
        model AS label,
        COUNT(*) AS count
      FROM aircraft
      WHERE 
        manufacturer = ?
        AND model IS NOT NULL
        AND model != ''
      GROUP BY model
      HAVING count > 0
      ORDER BY 
        count DESC,
        model ASC
    `;

    const models = await db.all<SelectOption[]>(query, [manufacturer]);

    console.log(`Fetched ${models.length} models for ${manufacturer}`);

    return res.status(200).json({ 
      models,
      meta: {
        total: models.length,
        manufacturer,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching models:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch models',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}