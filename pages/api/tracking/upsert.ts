// pages/api/tracking/upsert.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { TrackingDatabaseManager } from '@/lib/db/managers/trackingDatabaseManager';
import { Aircraft } from '@/types/base';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { APIErrors } from '@/lib/services/error-handler/api-error';

interface UpsertResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    successCount: number;
    errorCount: number;
    errors: Array<{ icao24: string; error: string }>;
  };
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UpsertResponse>
) {
  if (req.method !== 'POST') {
    throw APIErrors.BadRequest('Method not allowed');
  }

  const { aircraft } = req.body;
  if (!Array.isArray(aircraft) || aircraft.length === 0) {
    throw APIErrors.BadRequest('Invalid aircraft data: Empty or not an array');
  }

  const trackingDb = TrackingDatabaseManager.getInstance();
  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ icao24: string; error: string }> = [];

  try {
    await trackingDb.executeQuery('BEGIN TRANSACTION');

    for (const ac of aircraft) {
      try {
        if (
          !ac.icao24 ||
          typeof ac.latitude !== 'number' ||
          typeof ac.longitude !== 'number'
        ) {
          throw new Error('Missing required fields');
        }

        const sql = `
          INSERT INTO tracked_aircraft (
            icao24,
            manufacturer,
            model,
            "N-NUMBER",
            latitude,
            longitude,
            altitude,
            velocity,
            heading,
            on_ground,
            last_contact,
            TYPE_AIRCRAFT,
            NAME,
            CITY,
            STATE,
            OWNER_TYPE,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(icao24) DO UPDATE SET
            manufacturer = COALESCE(excluded.manufacturer, tracked_aircraft.manufacturer),
            model = COALESCE(NULLIF(excluded.model, ''), tracked_aircraft.model),
            latitude = excluded.latitude,
            longitude = excluded.longitude,
            altitude = excluded.altitude,
            velocity = excluded.velocity,
            heading = excluded.heading,
            on_ground = excluded.on_ground,
            last_contact = excluded.last_contact,
            TYPE_AIRCRAFT = COALESCE(NULLIF(excluded.TYPE_AIRCRAFT, ''), tracked_aircraft.TYPE_AIRCRAFT),
            "N-NUMBER" = COALESCE(NULLIF(excluded."N-NUMBER", ''), tracked_aircraft."N-NUMBER"),
            NAME = COALESCE(NULLIF(excluded.NAME, ''), tracked_aircraft.NAME),
            CITY = COALESCE(NULLIF(excluded.CITY, ''), tracked_aircraft.CITY),
            STATE = COALESCE(NULLIF(excluded.STATE, ''), tracked_aircraft.STATE),
            OWNER_TYPE = COALESCE(NULLIF(excluded.OWNER_TYPE, ''), tracked_aircraft.OWNER_TYPE),
            updated_at = excluded.updated_at`;

        await trackingDb.executeQuery(sql, [
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
          ac.TYPE_AIRCRAFT || '',
          ac.NAME || '',
          ac.CITY || '',
          ac.STATE || '',
          ac.OWNER_TYPE || '',
          Math.floor(Date.now() / 1000),
        ]);

        successCount++;
      } catch (error) {
        errorCount++;
        errors.push({
          icao24: ac.icao24,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    if (successCount > 0) {
      await trackingDb.executeQuery('COMMIT');
      return res.status(200).json({
        success: true,
        message: 'Aircraft batch updated successfully',
        data: {
          successCount,
          errorCount,
          errors,
        },
      });
    } else {
      await trackingDb.executeQuery('ROLLBACK');
      throw new Error('No successful updates completed');
    }
  } catch (error) {
    try {
      await trackingDb.executeQuery('ROLLBACK');
    } catch (rollbackError) {
      console.error('[TrackingAPI] Rollback failed:', rollbackError);
    }

    throw APIErrors.Internal(
      error instanceof Error
        ? error
        : new Error('Failed to update aircraft batch')
    );
  }
}

export default withErrorHandler(handler);
