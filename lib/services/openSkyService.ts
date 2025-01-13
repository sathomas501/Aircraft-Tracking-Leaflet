// lib/services/openSkyService.ts
import { getDb } from '@/lib/db/connection';
import { getActiveDb } from '@/lib/db/activeConnection';
import { openSkyService } from '@/lib/api/opensky';
import type { PositionData } from '@/types/api/opensky';

export class OpenSkyService {
  private static instance: OpenSkyService;
  private static ACTIVE_THRESHOLD = 7200; // 2 hours in seconds

  private constructor() {}

  public static getInstance(): OpenSkyService {
    if (!OpenSkyService.instance) {
      OpenSkyService.instance = new OpenSkyService();
    }
    return OpenSkyService.instance;
  }

  static async updateActiveAircraft(positions: PositionData[]): Promise<boolean> {
    const db = await getActiveDb();

    try {
      await db.run('BEGIN TRANSACTION');

      // Update or insert new active aircraft
      for (const position of positions) {
        if (!position.icao24) continue;

        await db.run(`
          INSERT INTO active_aircraft (
            icao24, last_contact, latitude, longitude, 
            altitude, velocity, heading, on_ground
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(icao24) DO UPDATE SET
            last_contact = ?,
            latitude = ?,
            longitude = ?,
            altitude = ?,
            velocity = ?,
            heading = ?,
            on_ground = ?
        `, [
          position.icao24,
          position.last_contact,
          position.latitude,
          position.longitude,
          position.altitude,
          position.velocity,
          position.heading,
          position.on_ground,
          // Update values
          position.last_contact,
          position.latitude,
          position.longitude,
          position.altitude,
          position.velocity,
          position.heading,
          position.on_ground
        ]);
      }

      // Remove stale records
      const currentTime = Math.floor(Date.now() / 1000);
      await db.run(`
        DELETE FROM active_aircraft 
        WHERE last_contact < ?
      `, [currentTime - OpenSkyService.ACTIVE_THRESHOLD]);

      await db.run('COMMIT');
      return true;
    } catch (error) {
      await db.run('ROLLBACK');
      console.error('Error updating active aircraft:', error);
      throw error;
    }
  }
}