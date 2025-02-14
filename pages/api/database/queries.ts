import type { NextApiRequest, NextApiResponse } from 'next';
import databaseManager from '@/lib/db/databaseManager';
import type { SelectOption } from '@/types/base';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { action, manufacturer } = req.query;

  try {
    if (action === 'getActiveIcao24ByManufacturer') {
      const query = `
                SELECT icao24 
                FROM aircraft 
                WHERE 
                    manufacturer = ? 
                    AND icao24 IS NOT NULL
                    AND icao24 != ''
            `;

      const rows = await databaseManager.allQuery<{ icao24: string }>(query, [
        manufacturer,
      ]);
      return res.status(200).json({ icao24s: rows.map((row) => row.icao24) });
    }

    if (action === 'getModelsByManufacturer') {
      const query = `
                SELECT 
                    model as value,
                    model as label,
                    COUNT(*) as count
                FROM aircraft 
                WHERE 
                    manufacturer = ?
                    AND model IS NOT NULL 
                    AND model != ''
                GROUP BY model
                HAVING count > 0
                ORDER BY count DESC, model ASC;
            `;

      const models = await databaseManager.allQuery<SelectOption>(query, [
        manufacturer,
      ]);
      return res.status(200).json({ models });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('Database query error:', error);
    return res.status(500).json({ error: 'Database query failed' });
  }
}
