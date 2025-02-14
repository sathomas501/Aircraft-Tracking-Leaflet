import type { NextApiRequest, NextApiResponse } from 'next';
import { Database, open } from 'sqlite';

const sqlite3 = require('sqlite3'); // ✅ Dynamically require it on the server
import path from 'path';

const STATIC_DB_PATH = path.join(process.cwd(), 'lib', 'db', 'static.db');

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { action, manufacturer, model } = req.query;

  try {
    if (action === 'getIcao24s') {
      const db = await open({
        filename: STATIC_DB_PATH,
        driver: sqlite3.Database,
      });

      const query = `
                SELECT DISTINCT icao24
                FROM aircraft
                WHERE manufacturer = ?
                ${model ? 'AND model = ?' : ''}
                AND icao24 IS NOT NULL
                AND icao24 != ''
            `;

      const rows = await db.all(
        query,
        model ? [manufacturer, model] : [manufacturer]
      );
      await db.close();

      return res.status(200).json({ icao24s: rows.map((row) => row.icao24) });
    }

    if (action === 'getCombinedAircraftData') {
      const staticDb = await open({
        filename: STATIC_DB_PATH,
        driver: sqlite3.Database,
      });

      const staticData = await staticDb.all(
        `
                SELECT DISTINCT icao24, manufacturer, model, "N-NUMBER", NAME, CITY, STATE, owner_type, aircraft_type
                FROM aircraft
                WHERE manufacturer = ?
                AND icao24 IS NOT NULL
                AND icao24 != ''
            `,
        [manufacturer]
      );

      await staticDb.close();

      return res.status(200).json({ combinedAircraftData: staticData });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('Database query error:', error);
    return res.status(500).json({ error: 'Database query failed' });
  }
}
