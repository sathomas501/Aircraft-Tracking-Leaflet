import type { NextApiRequest, NextApiResponse } from 'next';
import sqlite3 from 'sqlite3';
import path from 'path';

interface SelectOption {
  value: string;
  label: string;
  count: number;
}

const dbPath = path.join(process.cwd(), 'lib', 'db', 'aircraft.db');

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ manufacturers?: SelectOption[]; error?: string }>
) {
  console.log('Manufacturers API Request');

  let db!: sqlite3.Database;

  try {
    db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
    console.log('Database connection established');

    const query = `
      SELECT 
        manufacturer AS value,
        manufacturer AS label,
        COUNT(*) AS count
      FROM aircraft
      WHERE 
        manufacturer IS NOT NULL 
        AND manufacturer != ''
        AND LENGTH(TRIM(manufacturer)) >= 2
        AND icao24 IS NOT NULL
        AND LENGTH(TRIM(icao24)) > 0
      GROUP BY manufacturer
      HAVING COUNT(*) >= 10
      ORDER BY COUNT(*) DESC
      LIMIT 50;
    `;

    const manufacturers = await executeQuery<SelectOption>(db, query);
    console.log(`Successfully fetched ${manufacturers.length} manufacturers`);
    res.status(200).json({ manufacturers });
  } catch (error) {
    console.error('Error fetching manufacturers:', error);
    res.status(500).json({ error: 'Failed to fetch manufacturers' });
  } finally {
    if (db) {
      db.close((err) => {
        if (err) console.error('Error closing database:', err);
        else console.log('Database connection closed');
      });
    }
  }
}

// Helper function to execute queries
function executeQuery<T>(
  db: sqlite3.Database,
  query: string,
  params: (string | number)[] = []
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('Query execution error:', err);
        return reject(err);
      }
      resolve(rows as T[]);
    });
  });
}
