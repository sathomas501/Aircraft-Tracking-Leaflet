// pages/api/manufacturers.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { DatabaseManager } from '@/lib/db/databaseManager';
import type { SelectOption } from '@/types/base';

interface ManufacturersResponse {
  manufacturers: SelectOption[];
  error?: string;
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ManufacturersResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      manufacturers: [],
      error: 'Method not allowed',
    });
  }

  try {
    const db = DatabaseManager.getInstance();
    await db.initializeDatabase();

    console.log(
      '[Manufacturers] Fetching top 50 manufacturers, alphabetized...'
    );

    const result = await db.allQuery<{ name: string; count: number }>(
      `SELECT name, count FROM (
        SELECT 
          manufacturer AS name, 
          COUNT(*) AS count 
        FROM aircraft 
        WHERE manufacturer IS NOT NULL 
        AND manufacturer != ''
        GROUP BY manufacturer 
        ORDER BY count DESC
        LIMIT 50
      ) AS TopManufacturers
      ORDER BY name ASC`
    );

    const manufacturers = result.map((manufacturer) => ({
      value: manufacturer.name,
      label: manufacturer.name,
    }));

    return res.status(200).json({ manufacturers });
  } catch (error) {
    console.error('[Manufacturers] Error fetching data:', error);
    return res.status(500).json({
      manufacturers: [],
      error: 'Failed to fetch manufacturers',
    });
  }
}
