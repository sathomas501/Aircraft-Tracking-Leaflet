// pages/api/aircraft/tracking.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Aircraft } from '@/types/base';
import BackendDatabaseManager from '@/lib/db/backendDatabaseManager';
import { APIErrors } from '@/lib/services/error-handler/api-error';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[Tracking API] 📩 Received payload:', req.body);

  const dbManager = BackendDatabaseManager.getInstance();
  let attempts = 0;
  const maxAttempts = 3;

  while (!dbManager.isReady && attempts < maxAttempts) {
    console.warn(
      `[Tracking API] 🔄 Database not ready. Retrying... (${attempts + 1}/${maxAttempts})`
    );
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 sec
    attempts++;
  }

  if (!dbManager.isReady) {
    console.error('[Tracking API] ❌ Database initialization failed.');
    return res
      .status(500)
      .json({ success: false, error: 'Database is not ready' });
  }

  try {
    if (req.method === 'GET') {
      const query = `
                SELECT * FROM tracked_aircraft 
                WHERE last_contact > ? 
                ORDER BY last_contact DESC
            `;
      const staleThreshold = Math.floor(Date.now() / 1000) - 2 * 60 * 60;
      const trackedAircraft = await dbManager.executeQuery<Aircraft>(query, [
        staleThreshold,
      ]);
      return res.status(200).json({ success: true, aircraft: trackedAircraft });
    }

    if (req.method !== 'POST') {
      throw APIErrors.BadRequest('Method not allowed');
    }

    const { action, aircraft, positions } = req.body;
    if (!action) {
      throw APIErrors.BadRequest('Missing action in request');
    }

    console.log(`[Tracking API] Processing action: ${action}`);

    switch (action) {
      case 'upsertActiveAircraftBatch': {
        if (!aircraft || !Array.isArray(aircraft)) {
          throw APIErrors.BadRequest('Invalid aircraft data format');
        }

        console.log(`[Tracking API] 🛠️ Upserting ${aircraft.length} aircraft`);

        await dbManager.executeQuery('BEGIN TRANSACTION');

        try {
          for (const ac of aircraft) {
            const query = `
                            INSERT INTO active_tracking (
                                icao24, manufacturer, model, marker, latitude, longitude,
                                altitude, velocity, heading, on_ground, last_contact,
                                last_seen, TYPE_AIRCRAFT, "N-NUMBER", OWNER_TYPE, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT(icao24) DO UPDATE SET
                                manufacturer = COALESCE(excluded.manufacturer, active_tracking.manufacturer),
                                model = COALESCE(NULLIF(excluded.model, ''), active_tracking.model),
                                latitude = excluded.latitude,
                                longitude = excluded.longitude,
                                altitude = excluded.altitude,
                                velocity = excluded.velocity,
                                heading = excluded.heading,
                                on_ground = excluded.on_ground,
                                last_contact = excluded.last_contact,
                                last_seen = excluded.last_seen,
                                updated_at = excluded.updated_at
                        `;

            await dbManager.executeQuery(query, [
              ac.icao24,
              ac.manufacturer || '',
              ac.model || '',
              ac['N-NUMBER'] || '',
              ac.latitude,
              ac.longitude,
              ac.altitude || 0,
              ac.velocity || 0,
              ac.heading || 0,
              ac.on_ground ? 1 : 0,
              ac.last_contact || Math.floor(Date.now() / 1000),
              Date.now(),
              ac.TYPE_AIRCRAFT || '',
              ac['N-NUMBER'] || '',
              ac.OWNER_TYPE || '',
              Date.now(),
            ]);
          }

          await dbManager.executeQuery('COMMIT');
          console.log(`[Tracking API] ✅ Upserted ${aircraft.length} aircraft`);

          return res.status(200).json({
            success: true,
            message: `Aircraft batch upserted successfully`,
            count: aircraft.length,
          });
        } catch (error) {
          console.error('[Tracking API] ❌ Upsert failed:', error);
          await dbManager.executeQuery('ROLLBACK');
          throw error;
        }
      }

      default:
        throw APIErrors.BadRequest(`Invalid action: ${action}`);
    }
  } catch (error) {
    console.error(`[Tracking API] ❌ Error:`, error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
