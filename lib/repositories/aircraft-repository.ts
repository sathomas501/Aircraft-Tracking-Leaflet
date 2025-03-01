// lib/repositories/aircraft-repository.ts
import { BaseDatabaseManager } from '../db/managers/baseDatabaseManager';
import type { Aircraft } from '@/types/base';

interface Position {
  latitude: number;
  longitude: number;
  heading: number;
  altitude?: number;
  velocity?: number;
  on_ground?: boolean;
}

export class AircraftRepository {
  protected dbManager: BaseDatabaseManager;

  constructor(dbManager: BaseDatabaseManager) {
    this.dbManager = dbManager;
  }

  /**
   * Get all aircraft with the given ICAO24 codes
   */
  async getByIcao24(
    icao24s: string[],
    manufacturer?: string
  ): Promise<Aircraft[]> {
    if (!icao24s.length) {
      return [];
    }

    const placeholders = icao24s.map(() => '?').join(',');
    const params = manufacturer ? [...icao24s, manufacturer] : icao24s;
    const activeThreshold = Math.floor(Date.now() / 1000) - 2 * 60 * 60; // 2 hours

    const query = `
      SELECT * FROM tracked_aircraft 
      WHERE icao24 IN (${placeholders})
      AND last_contact > ?
      ${manufacturer ? 'AND LOWER(manufacturer) = LOWER(?)' : ''}
    `;

    return this.dbManager.executeQuery<Aircraft>(query, [
      ...params,
      activeThreshold,
    ]);
  }

  /**
   * Update aircraft position data
   */
  async updatePosition(icao24: string, position: Position): Promise<boolean> {
    try {
      const sql = `
      UPDATE tracked_aircraft 
      SET latitude = ?,
          longitude = ?,
          heading = ?,
          altitude = COALESCE(?, altitude),
          velocity = COALESCE(?, velocity),
          on_ground = COALESCE(?, on_ground),
          updated_at = strftime('%s', 'now')
      WHERE icao24 = ?
      `;

      await this.dbManager.executeQuery(sql, [
        position.latitude,
        position.longitude,
        position.heading,
        position.altitude,
        position.velocity,
        position.on_ground,
        icao24,
      ]);

      return true;
    } catch (error) {
      console.error('[AircraftRepository] Failed to update position:', error);
      return false;
    }
  }

  /**
   * Get all aircraft tracked for a specific manufacturer
   */
  async getTrackedAircraft(manufacturer?: string): Promise<Aircraft[]> {
    const activeThreshold = Math.floor(Date.now() / 1000) - 2 * 60 * 60; // 2 hours

    try {
      let query = `
        SELECT * FROM tracked_aircraft 
        WHERE last_contact > ? 
      `;
      const params: any[] = [activeThreshold];

      if (manufacturer) {
        query += ` AND LOWER(manufacturer) = LOWER(?)`;
        params.push(manufacturer);
      }

      console.log('[AircraftRepository] Fetching tracked aircraft:', {
        manufacturer: manufacturer || 'all',
        threshold: activeThreshold,
      });

      const rows = await this.dbManager.executeQuery<Aircraft>(query, params);

      return rows.map((row) => ({
        ...row,
        isTracked: true,
        lastSeen: Date.now(),
        on_ground: Boolean(row.on_ground),
      }));
    } catch (error) {
      console.error(
        '[AircraftRepository] Failed to get tracked aircraft:',
        error
      );
      throw error;
    }
  }

  /**
   * Batch insert or update active aircraft data
   */
  async upsertActiveAircraftBatch(aircraftData: Aircraft[]): Promise<number> {
    if (!aircraftData.length) {
      console.log('[AircraftRepository] No aircraft to upsert');
      return 0;
    }

    let successCount = 0;

    try {
      // Get database instance for prepared statements
      const db = await this.dbManager.getDatabase();

      // Start transaction
      await this.dbManager.executeQuery('BEGIN TRANSACTION');

      // Prepare the statement once for better performance
      const stmt = await db.prepare(`
        INSERT INTO tracked_aircraft (
          icao24, manufacturer, model, "N-NUMBER", latitude, longitude,
          altitude, velocity, heading, on_ground, last_contact,
          TYPE_AIRCRAFT, NAME, CITY, STATE, OWNER_TYPE, updated_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
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
          updated_at = excluded.updated_at,
          status = 'active'
      `);

      // Process each aircraft
      for (const aircraft of aircraftData) {
        try {
          await stmt.run(
            aircraft.icao24,
            aircraft.manufacturer || '',
            aircraft.model || '',
            aircraft['N-NUMBER'] || '',
            aircraft.latitude,
            aircraft.longitude,
            aircraft.altitude || 0,
            aircraft.velocity || 0,
            aircraft.heading || 0,
            aircraft.on_ground ? 1 : 0,
            Math.floor(Date.now() / 1000),
            aircraft.TYPE_AIRCRAFT || '',
            aircraft.NAME || '',
            aircraft.CITY || '',
            aircraft.STATE || '',
            aircraft.OWNER_TYPE || '',
            Math.floor(Date.now() / 1000)
          );

          successCount++;
        } catch (insertError) {
          console.error(
            `[AircraftRepository] Error inserting aircraft ${aircraft.icao24}:`,
            insertError
          );
        }
      }

      // Finalize the prepared statement
      await stmt.finalize();

      // Commit transaction
      await this.dbManager.executeQuery('COMMIT');

      console.log(
        `[AircraftRepository] ✅ Successfully upserted ${successCount} aircraft as active`
      );
      return successCount;
    } catch (error) {
      console.error(
        '[AircraftRepository] Failed to upsert aircraft batch:',
        error
      );

      // Rollback transaction
      try {
        await this.dbManager.executeQuery('ROLLBACK');
      } catch (rollbackError) {
        console.error('[AircraftRepository] Rollback failed:', rollbackError);
      }

      throw error;
    }
  }

  /**
   * Get all ICAOs that are currently tracked
   */
  async getTrackedICAOs(): Promise<string[]> {
    const activeThreshold = Math.floor(Date.now() / 1000) - 2 * 60 * 60; // 2 hours

    try {
      const query = `
      SELECT DISTINCT icao24 
      FROM tracked_aircraft 
      WHERE last_contact > ?
      ORDER BY icao24
      `;

      const rows = await this.dbManager.executeQuery<{ icao24: string }>(
        query,
        [activeThreshold]
      );

      return rows.map((row) => row.icao24);
    } catch (error) {
      console.error(
        '[AircraftRepository] Failed to fetch tracked ICAOs:',
        error
      );
      throw error;
    }
  }
}
