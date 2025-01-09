// pages/api/aircraft/models.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/db/connection';

interface SelectOption {
  value: string;
  label: string;
  count: number;
}

interface ModelsResponse {
  models?: SelectOption[];
  error?: string;
  message?: string;
}

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

  const { manufacturer, activeOnly } = req.query;

  if (!manufacturer || typeof manufacturer !== 'string') {
    return res.status(400).json({ 
      error: 'Missing manufacturer',
      message: 'Manufacturer parameter is required'
    });
  }

  console.log(`Models API Request for manufacturer: ${manufacturer}, activeOnly: ${activeOnly}`);

  try {
    const db = await getDb();
    
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
        AND LENGTH(TRIM(model)) >= 2
        ${activeOnly === 'true' ? 'AND active = 1' : ''}
      GROUP BY model
      HAVING COUNT(*) > 0
      ORDER BY COUNT(*) DESC, model ASC;
    `;

    const models = await db.all<SelectOption[]>(query, [manufacturer]);
    console.log(`Successfully fetched ${models.length} models for ${manufacturer}`);
    
    res.status(200).json({ models });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ 
      error: 'Failed to fetch models',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
}