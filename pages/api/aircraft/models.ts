// pages/api/aircraft/models.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase } from '@/lib/db/databaseManager';
import type { SelectOption } from '@/types/base';
import type { ModelsResponse } from '@/types/api/common';

const db = await getDatabase();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ModelsResponse>
) {
  const { manufacturer } = req.query;

  if (!manufacturer || typeof manufacturer !== 'string') {
    return res.status(400).json({ 
      error: 'Missing manufacturer',
      message: 'Manufacturer parameter is required'
    });
  }

  try {
    const db = await getDatabase();
    
    // Simple query to get all models for the manufacturer
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
      ORDER BY model ASC
    `;

    const models = await db.all<SelectOption[]>(query, [manufacturer]);
    return res.status(200).json({ models });

  } catch (error) {
    console.error('Error fetching models:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch models',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}