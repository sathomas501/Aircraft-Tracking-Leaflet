import type { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase } from '@/lib/db/databaseManager';

interface Icao24Response {
  icao24List: string[];
  meta?: {
    total: number;
    manufacturer: string;
    model?: string;
    timestamp: string;
  };
  error?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Icao24Response>) {
  try {
    console.log('Incoming request:', req.method, req.body);

    if (req.method !== 'POST') {
      return res.status(405).json({ icao24List: [], error: 'Method Not Allowed' });
    }

    const { manufacturer, model } = req.body;

    if (!manufacturer || typeof manufacturer !== 'string') {
      return res.status(400).json({ icao24List: [], error: 'Manufacturer parameter is required' });
    }

    const db = await getDatabase();

    let query = `
      SELECT DISTINCT icao24
      FROM aircraft
      WHERE manufacturer = ?
        AND icao24 IS NOT NULL
        AND icao24 != ''
    `;
    const params = [manufacturer];

    if (model) {
      query += ` AND model = ?`;
      params.push(model as string);
    }

    query += ' LIMIT 500';

    console.log('Executing query:', query, params);
    const aircraft = (await db.all(query, params)) || [];

console.log('Query executed:', query, 'with params:', params);
console.log('Aircraft fetched:', aircraft);

if (aircraft.length === 0) {
  return res.status(200).json({
    icao24List: [],
    meta: {
      total: 0,
      manufacturer,
      model: model || 'all',
      timestamp: new Date().toISOString(),
    },
  });
}

const icao24List = aircraft
  .filter(a => a.icao24) // Ensure `icao24` exists
  .map(a => a.icao24);

res.status(200).json({
  icao24List,
  meta: {
    total: aircraft.length,
    manufacturer,
    model: model || 'all',
    timestamp: new Date().toISOString(),
  },
});

  } catch (error) {
    console.error('Error in handler:', error);
    res.status(500).json({
      icao24List: [],
      error: 'Failed to fetch ICAO24 list',
    });
  }
}
