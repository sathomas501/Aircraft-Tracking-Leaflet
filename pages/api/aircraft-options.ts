import type { NextApiRequest, NextApiResponse } from 'next';
import sqlite3 from 'sqlite3';
import path from 'path';

interface SelectOption {
  value: string;
  label: string;
  count: number;
}

interface ApiResponse {
  manufacturers?: SelectOption[];
  models?: SelectOption[];
  types?: SelectOption[];
  error?: string;
}

const AIRCRAFT_TYPES = [
  { value: '4', label: 'Fixed wing single engine', count: 0 },
  { value: '5', label: 'Fixed wing multi engine', count: 0 },
  { value: '6', label: 'Rotorcraft', count: 0 },
];

const dbPath = path.join(process.cwd(), 'lib', 'db', 'aircraft.db');
console.log('Current working directory:', process.cwd());


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  console.log('Aircraft Options API Request:', req.query);

  const manufacturer = Array.isArray(req.query.manufacturer)
    ? req.query.manufacturer[0]
    : req.query.manufacturer;

  const type = Array.isArray(req.query.type) ? req.query.type[0] : req.query.type;

  let db!: sqlite3.Database;

  try {
    db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
    console.log('Database connection established');

    // Handle aircraft types request
    if (type === 'options') {
      console.log('Returning aircraft types');
      return res.status(200).json({ types: AIRCRAFT_TYPES });
    }

    // Fetch manufacturers if no specific manufacturer is provided
    if (!manufacturer) {
      console.log('Fetching manufacturers list...');
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
      console.log(`Successfully processed ${manufacturers.length} manufacturers`);
      return res.status(200).json({ manufacturers });
    }

    // Fetch models for a specific manufacturer
    if (manufacturer) {
      console.log(`Fetching models for manufacturer: ${manufacturer}`);
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
        GROUP BY model
        HAVING COUNT(*) > 0
        ORDER BY COUNT(*) DESC, model ASC;
      `;

      const models = await executeQuery<SelectOption>(db, query, [manufacturer]);
      console.log(`Successfully processed ${models.length} models for ${manufacturer}`);
      return res.status(200).json({ models });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    if (db) {
      db.close((err) => {
        if (err) console.error('Error closing database:', err);
        else console.log('Database connection closed');
      });
    }
  }

  console.log('Request reached end without matching any conditions');
  return res.status(400).json({ error: 'Invalid request parameters' });
}

// Helper function to execute queries with proper error handling
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
