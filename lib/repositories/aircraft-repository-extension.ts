// lib/repositories/aircraft-repository-extension.ts
import { AircraftRepository } from './aircraft-repository';
import { BaseDatabaseManager } from '../db/managers/baseDatabaseManager';
import type { Aircraft } from '@/types/base';
import { AircraftModel } from '@/types/aircraft-types';

/**
 * Extended repository with additional methods needed by useAircraftSelector
 */
export class ExtendedAircraftRepository extends AircraftRepository {
  constructor(dbManager: BaseDatabaseManager) {
    super(dbManager);
  }

  /**
   * Get aircraft by ICAO24 codes
   */
  async getAircraftByIcao24s(icao24s: string[]): Promise<Aircraft[]> {
    if (!icao24s.length) return [];

    const placeholders = icao24s.map(() => '?').join(',');
    const activeThreshold = Math.floor(Date.now() / 1000) - 2 * 60 * 60; // 2 hours

    const query = `
      SELECT * FROM tracked_aircraft 
      WHERE icao24 IN (${placeholders})
      AND last_contact > ?
    `;

    return this.dbManager.executeQuery<Aircraft>(query, [
      ...icao24s,
      activeThreshold,
    ]);
  }

  /**
   * Get unique models for a manufacturer with counts
   */
  async getModelsForManufacturer(
    manufacturer: string
  ): Promise<AircraftModel[]> {
    if (!manufacturer) return [];

    try {
      // Get models with counts from database
      const query = `
        SELECT 
          model, 
          manufacturer,
          COUNT(*) as count,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as activeCount
        FROM tracked_aircraft
        WHERE manufacturer = ? AND model IS NOT NULL AND model != ''
        GROUP BY model
        ORDER BY count DESC
      `;

      const rows = await this.dbManager.executeQuery<{
        model: string;
        manufacturer: string;
        count: number;
        activeCount: number;
      }>(query, [manufacturer]);

      // Transform to AircraftModel format
      return rows.map((row) => ({
        model: row.model,
        manufacturer: row.manufacturer,
        label: `${row.model} (${row.activeCount} active of ${row.count})`,
        activeCount: row.activeCount,
        count: row.count,
        totalCount: row.count,
      }));
    } catch (error) {
      console.error(
        '[ExtendedAircraftRepository] Error getting models:',
        error
      );
      return [];
    }
  }

  /**
   * Get aircraft filtered by manufacturer and model
   */
  async getFilteredAircraft(
    manufacturer: string,
    model?: string
  ): Promise<Aircraft[]> {
    try {
      let query = `
        SELECT * FROM tracked_aircraft 
        WHERE manufacturer = ?
        AND last_contact > ?
      `;

      const params: any[] = [
        manufacturer,
        Math.floor(Date.now() / 1000) - 2 * 60 * 60, // 2 hours
      ];

      if (model) {
        query += ` AND (model = ? OR TYPE_AIRCRAFT = ?)`;
        params.push(model, model);
      }

      const rows = await this.dbManager.executeQuery<Aircraft>(query, params);

      return rows.map((row) => ({
        ...row,
        isTracked: true,
        lastSeen: Date.now(),
        on_ground: Boolean(row.on_ground),
      }));
    } catch (error) {
      console.error(
        '[ExtendedAircraftRepository] Error getting filtered aircraft:',
        error
      );
      return [];
    }
  }
}
