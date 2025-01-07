//pages/api/modes.ts

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
  res: NextApiResponse<{ models?: SelectOption[]; error?: string }>
) {
  const { manufacturer } = req.query;

  if (!manufacturer || typeof manufacturer !== 'string') {
    return res.status(400).json({ error: 'Manufacturer is required' });
  }

  console.log(`Models API Request for manufacturer: ${manufacturer}`);

  let db!: sqlite3.Database;

  try {
    db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
    console.log('Database connection established');

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
    console.log(`Successfully fetched ${models.length} models for ${manufacturer}`);
    res.status(200).json({ models });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
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
