// File: pages/api/tracking/upsert.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import DatabaseConnection from './db';
import { Aircraft } from '@/types/base';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  const { aircraft } = req.body;

  if (!Array.isArray(aircraft) || aircraft.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid aircraft data: Empty or not an array',
    });
  }

  const db = await DatabaseConnection.getInstance();
  let successCount = 0;
  let errorCount = 0;
  const errors: { icao24: string; error: string }[] = [];

  try {
    await db.run('BEGIN TRANSACTION');

    for (const ac of aircraft) {
      try {
        if (
          !ac.icao24 ||
          typeof ac.latitude !== 'number' ||
          typeof ac.longitude !== 'number'
        ) {
          throw new Error('Missing required fields');
        }

        await DatabaseConnection.executeQuery(
          `INSERT INTO active_tracking (
            icao24, manufacturer, model, marker, latitude, longitude, 
            altitude, velocity, heading, on_ground, last_contact, 
            last_seen, TYPE_AIRCRAFT, "N-NUMBER", OWNER_TYPE, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(icao24) DO UPDATE SET
            manufacturer = COALESCE(excluded.manufacturer, active_tracking.manufacturer),
            model = COALESCE(NULLIF(excluded.model, ''), active_tracking.model),
            marker = COALESCE(NULLIF(excluded.marker, ''), active_tracking.marker),
            latitude = excluded.latitude,
            longitude = excluded.longitude,
            altitude = excluded.altitude,
            velocity = excluded.velocity,
            heading = excluded.heading,
            on_ground = excluded.on_ground,
            last_contact = excluded.last_contact,
            last_seen = excluded.last_seen,
            TYPE_AIRCRAFT = COALESCE(NULLIF(excluded.TYPE_AIRCRAFT, ''), active_tracking.TYPE_AIRCRAFT),
            "N-NUMBER" = COALESCE(NULLIF(excluded."N-NUMBER", ''), active_tracking."N-NUMBER"),
            OWNER_TYPE = COALESCE(NULLIF(excluded.OWNER_TYPE, ''), active_tracking.OWNER_TYPE),
            updated_at = excluded.updated_at;`,
          [
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
            ac.lastSeen || Date.now(),
            ac.TYPE_AIRCRAFT || '',
            ac['N-NUMBER'] || '',
            ac.OWNER_TYPE || '',
            Date.now(),
          ]
        );
        successCount++;
      } catch (error) {
        errorCount++;
        errors.push({ icao24: ac.icao24, error: (error as Error).message });
      }
    }

    if (successCount > 0) {
      await db.run('COMMIT');
    } else {
      await db.run('ROLLBACK');
      throw new Error('No successful updates completed');
    }

    res.status(200).json({
      success: true,
      message: 'Aircraft batch updated successfully',
      successCount,
      errorCount,
      errors,
    });
  } catch (error) {
    await db.run('ROLLBACK');
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
}
