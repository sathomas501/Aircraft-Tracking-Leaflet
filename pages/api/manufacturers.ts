// pages/api/manufacturers.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/db/connection';

interface SelectOption {
  value: string;
  label: string;
  count: number;
}

interface ManufacturersResponse {
  manufacturers?: SelectOption[];
  error?: string;
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ManufacturersResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: `HTTP method ${req.method} is not supported.`
    });
  }

  const { activeOnly } = req.query;
  const activeFilter = activeOnly === 'true' ? 'AND active = 1' : '';

  try {
    const db = await getDb();
    const query = `
      SELECT 
        manufacturer AS value,
        manufacturer AS label,
        COUNT(*) AS count
      FROM aircraft
      WHERE manufacturer IS NOT NULL 
        AND manufacturer != ''
        AND LENGTH(TRIM(manufacturer)) >= 2
        AND icao24 IS NOT NULL
        AND LENGTH(TRIM(icao24)) > 0
        ${activeFilter}
      GROUP BY manufacturer
      HAVING COUNT(*) >= 10
      ORDER BY COUNT(*) DESC
      LIMIT 50;
    `;

    const manufacturers = await db.all<SelectOption[]>(query);
    res.status(200).json({ manufacturers });
  } catch (error) {
    console.error('Error fetching manufacturers:', error);
    res.status(500).json({ 
      error: 'Failed to fetch manufacturers',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      manufacturers: []
    });
  }
}