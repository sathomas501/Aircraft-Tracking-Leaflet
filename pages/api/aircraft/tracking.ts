import type { NextApiRequest, NextApiResponse } from 'next';
import { Aircraft } from '@/types/base';
import CacheManager from '@/lib/services/managers/cache-manager';
import BackendDatabaseManager from '@/lib/db/backendDatabaseManager';
import { APIErrors } from '@/lib/services/error-handler/api-error';
import {
  errorHandler,
  ErrorType,
} from '@/lib/services/error-handler/error-handler';

// Initialize CacheManager with a 5-minute TTL
const icaoCache = new CacheManager<string[]>(5 * 60);

export interface TrackingUpdateRequest {
  action:
    | 'updatePositions'
    | 'getTrackedAircraft'
    | 'removeAircraft'
    | 'fetchAndStoreActiveAircraft'
    | 'upsertActiveAircraftBatch';
  manufacturer?: string;
  positions?: Aircraft[];
  aircraft?: Aircraft[];
  icao24s?: string[];
  icao24?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[Tracking API] 📩 Received payload:', req.body);

  try {
    const db = await BackendDatabaseManager.getInstance();

    if (req.method === 'GET') {
      const query = `
        SELECT * FROM tracked_aircraft 
        WHERE last_contact > ? 
        ORDER BY last_contact DESC
      `;
      const staleThreshold = Math.floor(Date.now() / 1000) - 2 * 60 * 60; // 2 hours
      const trackedAircraft = await db.executeQuery<Aircraft>(query, [
        staleThreshold,
      ]);
      return res.status(200).json({ success: true, aircraft: trackedAircraft });
    }

    if (req.method !== 'POST') {
      throw APIErrors.BadRequest('Method not allowed');
    }

    const { action, aircraft, positions } = req.body;
    console.log(`[Tracking API] Received action: ${action}`);

    if (!action) {
      throw APIErrors.BadRequest('Missing action in request');
    }

    switch (action) {
      case 'getTrackedAircraft': {
        const query = `
          SELECT * FROM tracked_aircraft 
          WHERE last_contact > ? 
          ORDER BY last_contact DESC
        `;
        const staleThreshold = Math.floor(Date.now() / 1000) - 2 * 60 * 60;
        const trackedAircraft = await db.executeQuery<Aircraft>(query, [
          staleThreshold,
        ]);
        return res.status(200).json({
          success: true,
          aircraft: trackedAircraft,
        });
      }

      case 'upsertActiveAircraftBatch': {
        const aircraftData = aircraft || positions;
        if (!aircraftData || !Array.isArray(aircraftData)) {
          throw APIErrors.BadRequest('Invalid aircraft data format');
        }

        console.log(`[Tracking API] Processing aircraft batch upsert...`);

        // Begin transaction
        await db.executeQuery('BEGIN TRANSACTION');

        try {
          for (const ac of aircraftData) {
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

            await db.executeQuery(query, [
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

          await db.executeQuery('COMMIT');

          return res.status(200).json({
            success: true,
            message: 'Aircraft batch upserted successfully',
          });
        } catch (error) {
          await db.executeQuery('ROLLBACK');
          throw error;
        }
      }

      default:
        throw APIErrors.BadRequest(`Invalid action: ${action}`);
    }
  } catch (error) {
    console.error(`[Tracking API] ❌ Error:`, error);

    if (error instanceof Error) {
      errorHandler.handleError(ErrorType.OPENSKY_SERVICE, error);
    } else {
      errorHandler.handleError(
        ErrorType.OPENSKY_SERVICE,
        new Error('Unknown error occurred')
      );
    }

    return res.status(error instanceof APIErrors.BadRequest ? 400 : 500).json({
      success: false,
      message:
        error instanceof Error ? error.message : 'An unknown error occurred',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
