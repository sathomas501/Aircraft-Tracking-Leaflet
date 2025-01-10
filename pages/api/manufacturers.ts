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
  console.log('Manufacturers API called with query:', req.query);

  if (req.method !== 'GET') {
    console.log(`Invalid method ${req.method} called`);
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: `HTTP method ${req.method} is not supported.`
    });
  }

  const { activeOnly } = req.query;
  const activeFilter = activeOnly === 'true' ? 'AND active = 1' : '';

  try {
    console.log('Attempting to get database connection...');
    const db = await getDb();
    console.log('Database connection successful');

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

    console.log('Executing query:', query);
    const manufacturers = await db.all<SelectOption[]>(query);
    console.log(`Query successful, found ${manufacturers?.length || 0} manufacturers`);

    res.status(200).json({ manufacturers });
  } catch (error) {
    const err = error as Error;
    console.error('Error in manufacturers API:', {
      name: err.name,
      message: err.message,
      stack: err.stack,
    });

    res.status(500).json({ 
      error: 'Failed to fetch manufacturers',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
      manufacturers: []
    });
  }
}