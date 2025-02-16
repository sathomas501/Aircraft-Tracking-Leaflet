// pages/api/aircraft/icao24s.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import databaseManager from '@/lib/db/databaseManager';
import BackendDatabaseManager from '@/lib/db/backendDatabaseManager';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { APIErrors } from '@/lib/services/error-handler/api-error';
import type { Aircraft } from '@/types/base';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { action } = req.query;

  if (!action) {
    throw APIErrors.BadRequest('Missing action parameter');
  }

  if (action === 'fetchByManufacturer') {
    return await fetchByManufacturer(req, res);
  } else if (action === 'fetchByIcao') {
    return await fetchByIcao(req, res);
  }

  return res.status(400).json({ success: false, error: 'Invalid action' });
}

async function fetchByManufacturer(req: NextApiRequest, res: NextApiResponse) {
  const manufacturer =
    req.method === 'POST' ? req.body.manufacturer : req.query.manufacturer;
  if (!manufacturer) {
    throw APIErrors.BadRequest('Manufacturer parameter is required');
  }

  if (!databaseManager.isReady) {
    await databaseManager.initializeDatabase();
  }

  console.log(`[ICAO API] 🔍 Fetching ICAOs for manufacturer: ${manufacturer}`);

  const query = `
    SELECT DISTINCT icao24
    FROM aircraft
    WHERE manufacturer = ?
    AND icao24 IS NOT NULL AND icao24 != ''
    AND LENGTH(icao24) = 6
    AND LOWER(icao24) GLOB '[0-9a-f]*'
    ORDER BY icao24
  `;

  const results = await databaseManager.executeQuery<{ icao24: string }>(
    query,
    [manufacturer]
  );

  const icao24List = results.map((item) => item.icao24.toLowerCase());

  return res.status(200).json({
    success: true,
    data: { icao24List, meta: { total: icao24List.length, manufacturer } },
    message: `Found ${icao24List.length} aircraft for ${manufacturer}`,
  });
}

async function fetchByIcao(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    throw APIErrors.BadRequest('Method not allowed');
  }

  const { icao24s } = req.body;
  if (!Array.isArray(icao24s) || icao24s.length === 0) {
    throw APIErrors.BadRequest('Invalid ICAO24 list');
  }

  const db = await BackendDatabaseManager.getInstance();
  const placeholders = icao24s.map(() => '?').join(',');

  const trackedAircraft = await db.executeQuery<Aircraft[]>(
    `SELECT * FROM tracked_aircraft WHERE icao24 IN (${placeholders})`,
    icao24s
  );

  return res.status(200).json({ success: true, data: trackedAircraft });
}

export default withErrorHandler(handler);
