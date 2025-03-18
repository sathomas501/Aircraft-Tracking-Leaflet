// lib/db/managers/trackingDatabaseManager.ts

import { BaseDatabaseManager } from './baseDatabaseManager';
import CleanupService from '../../services/CleanupService';
import type { Aircraft } from '@/types/base';
import sqlite3 from 'sqlite3';

export class TrackingDatabaseManager extends BaseDatabaseManager {
  private static instance: TrackingDatabaseManager | null = null;
  private static initializing: Promise<TrackingDatabaseManager | null> | null =
    null; // Track initialization state

  private constructor() {
    const trackingDbPath = process.env.TRACKING_DB_PATH || 'tracking.db';

    if (!trackingDbPath.endsWith('tracking.db')) {
      throw new Error(
        `[TrackingDB] 🚨 Invalid database path: ${trackingDbPath}`
      );
    }

    super(trackingDbPath);
  }

  /**
   * Get the singleton instance of TrackingDatabaseManager
   */
  public static async getInstance(): Promise<TrackingDatabaseManager> {
    if (TrackingDatabaseManager.instance) {
      return TrackingDatabaseManager.instance;
    }

    if (!TrackingDatabaseManager.initializing) {
      console.warn(
        '[TrackingDB] ⚠️ Database not initialized, creating new instance...'
      );
      TrackingDatabaseManager.instance = new TrackingDatabaseManager();
      TrackingDatabaseManager.initializing = TrackingDatabaseManager.instance
        .initializeDatabase()
        .then(() => {
          console.log('[TrackingDB] ✅ Database initialized successfully.');
          return TrackingDatabaseManager.instance;
        })
        .catch((err) => {
          console.error('[TrackingDB] ❌ Failed to initialize database:', err);
          TrackingDatabaseManager.instance = null; // Ensure next call reattempts
          throw err;
        })
        .finally(() => {
          TrackingDatabaseManager.initializing = null;
        });
    }

    const instance = await TrackingDatabaseManager.initializing;
    if (!instance) {
      throw new Error('[TrackingDB] ❌ Failed to initialize database');
    }
    return instance;
  }

  /**
   * Check if database is fully initialized and ready
   */
  public get isReady(): boolean {
    return this._isInitialized && this.db !== null;
  }

  // Add this function to avoid import errors
  public static getDefaultInstance(): TrackingDatabaseManager {
    if (!TrackingDatabaseManager.instance) {
      TrackingDatabaseManager.instance = new TrackingDatabaseManager();
    }
    return TrackingDatabaseManager.instance;
  }

  async executeWithRetry(
    query: string,
    params: any[] = [],
    retries = 5
  ): Promise<sqlite3.RunResult> {
    const db = await this.getDatabase();

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        console.log(
          `[TrackingDatabaseManager] 🚀 Executing query (Attempt ${attempt + 1}/${retries}): ${query}`
        );

        // Correctly promisify `db.run()` while ensuring TypeScript recognizes it as `RunResult`
        const result = await new Promise<sqlite3.RunResult>(
          (resolve, reject) => {
            db.run(
              query,
              params,
              function (this: sqlite3.RunResult, err: Error | null) {
                if (err) reject(err);
                else resolve(this);
              }
            );
          }
        );

        return result; // Ensures TypeScript recognizes the correct return type
      } catch (error: any) {
        if (error.code === 'SQLITE_BUSY' && attempt < retries - 1) {
          const delay = 100 * (attempt + 1);
          console.warn(
            `[TrackingDatabaseManager] ⚠️ Database is locked. Retrying in ${delay}ms... (${attempt + 1}/${retries})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay)); // Exponential backoff
        } else {
          console.error(
            `[TrackingDatabaseManager] ❌ Query failed after ${attempt + 1} attempts:\n Query: ${query}\n Params: ${JSON.stringify(params)}\n Error:`,
            error
          );
          throw new Error(
            `[TrackingDatabaseManager] Max retries reached. Query failed: ${query}`
          );
        }
      }
    }

    // If all retries fail, throw an explicit error (should never reach here)
    throw new Error(
      `[TrackingDatabaseManager] Query permanently failed: ${query}`
    );
  }

  /**
   * Create necessary tables (implements abstract method from BaseDatabaseManager)
   */
  protected async createTables(): Promise<void> {
    try {
      if (!this.db) {
        throw new Error('[TrackingDB] ❌ Database not initialized');
      }

      console.log('[TrackingDB] 🛠️ Creating necessary tables...');

      await this.db.exec(`
      CREATE TABLE IF NOT EXISTS tracked_aircraft (
        icao24 TEXT PRIMARY KEY,
        latitude REAL,
        longitude REAL,
        altitude REAL,
        velocity REAL,
        heading REAL,
        on_ground INTEGER,
        last_contact INTEGER,
        manufacturer TEXT,
        model TEXT,
        updated_at INTEGER DEFAULT (strftime('%s', 'now')) -- Unix timestamp
      );

      CREATE INDEX IF NOT EXISTS idx_tracked_icao24 ON tracked_aircraft(icao24);
      CREATE INDEX IF NOT EXISTS idx_tracked_manufacturer ON tracked_aircraft(manufacturer);
    `);

      console.log('[TrackingDB] ✅ Tables and indices created');
    } catch (error) {
      console.error('[TrackingDB] ❌ Error creating tables:', error);
      throw error;
    }
  }

  /**
   * Add model column to tracked_aircraft table if it doesn't exist
   */
  public async addModelColumnIfNotExists(): Promise<void> {
    const db = await this.getDatabase();

    try {
      // Check if model column exists
      const tableInfo = await db.all('PRAGMA table_info(tracked_aircraft)');
      const modelColumnExists = tableInfo.some(
        (column) => column.name === 'model'
      );

      if (!modelColumnExists) {
        console.log(
          '[TrackingDatabaseManager] Adding model column to tracked_aircraft table'
        );

        // Add the model column
        await db.exec('ALTER TABLE tracked_aircraft ADD COLUMN model TEXT');

        console.log(
          '[TrackingDatabaseManager] Model column added successfully'
        );
      } else {
        console.log('[TrackingDatabaseManager] Model column already exists');
      }
    } catch (error) {
      console.error(
        '[TrackingDatabaseManager] Error adding model column:',
        error
      );
      throw error;
    }
  }

  /**
   * Get active ICAO24 codes for a manufacturer
   */
  async getActiveIcao24s(manufacturer: string): Promise<string[]> {
    try {
      const twoHoursAgo = Date.now() - 7200000; // 2 hours in milliseconds

      const query = `
      SELECT icao24 FROM tracked_aircraft 
      WHERE manufacturer = ? AND updated_at > ?
    `;

      const results = await this.executeQuery<{ icao24: string }>(query, [
        manufacturer,
        twoHoursAgo,
      ]);

      return results.map((r) => r.icao24);
    } catch (error) {
      console.error(
        `[TrackingDatabaseManager] Error getting active ICAO24s:`,
        error
      );
      return [];
    }
  }

  /**
   * Update the position of a single aircraft
   * @param icao24 The ICAO24 code of the aircraft
   * @param latitude The latitude coordinate
   * @param longitude The longitude coordinate
   * @param heading The heading in degrees (optional)
   * @param altitude The altitude in feet (optional)
   * @param velocity The velocity in knots (optional)
   * @param on_ground Whether the aircraft is on the ground (optional)
   * @returns True if the update was successful, false otherwise
   */
  async updatePosition(
    icao24: string,
    latitude: number,
    longitude: number,
    heading: number = 0,
    altitude: number = 0,
    velocity: number = 0,
    on_ground: boolean = false
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (!icao24) {
        return { success: false, message: 'Missing ICAO24' };
      }

      const db = await this.getDatabase();

      if (isNaN(latitude) || isNaN(longitude)) {
        return { success: false, message: 'Invalid coordinates' };
      }

      console.log(
        `[TrackingDB] Updating ${icao24}: LAT=${latitude}, LON=${longitude}, HDG=${heading}`
      );

      const sql = `
    UPDATE tracked_aircraft 
    SET 
      latitude = ?, 
      longitude = ?, 
      heading = ?, 
      altitude = ?, 
      velocity = ?, 
      on_ground = ?,
      last_contact = ?,
      updated_at = ?
    WHERE icao24 = ?
    `;

      const result = await db.run(sql, [
        latitude,
        longitude,
        heading,
        altitude,
        velocity,
        on_ground ? 1 : 0,
        Math.floor(Date.now() / 1000),
        Date.now(),
        icao24,
      ]);

      const success = (result?.changes ?? 0) > 0; // Ensures `changes` is never undefined

      if (success) {
        return { success: true, message: `Updated ${icao24} successfully` };
      } else {
        return {
          success: false,
          message: `No aircraft found with ICAO24 ${icao24}`,
        };
      }
    } catch (error) {
      console.error(`[TrackingDB] ❌ Error updating ${icao24}:`, error);
      return { success: false, message: 'Database error' };
    }
  }

  /**
   * Get all ICAO24 codes that are being tracked
   */
  async getTrackedICAOs(): Promise<string[]> {
    try {
      const query = `
      SELECT icao24 FROM tracked_aircraft 
      WHERE updated_at > ?
    `;

      const twoHoursAgo = Date.now() - 7200000; // 2 hours in milliseconds
      const results = await this.executeQuery<{ icao24: string }>(query, [
        twoHoursAgo,
      ]);

      return results.map((r) => r.icao24);
    } catch (error) {
      console.error(
        `[TrackingDatabaseManager] Error getting tracked ICAOs:`,
        error
      );
      return [];
    }
  }

  /**
   * Upsert a batch of aircraft
   */
  async upsertActiveAircraftBatch(aircraft: Aircraft[]): Promise<number> {
    if (!Array.isArray(aircraft) || aircraft.length === 0) {
      console.log('[TrackingDatabaseManager] No aircraft to upsert');
      return 0;
    }

    // Only log the manufacturer distribution once for the entire batch
    const manufacturerCounts = aircraft.reduce(
      (acc, plane) => {
        const mfg = plane.manufacturer || 'Empty';
        acc[mfg] = (acc[mfg] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    console.log(
      `[TrackingDatabaseManager] Manufacturer distribution: ${JSON.stringify(manufacturerCounts)}`
    );

    // Also count model values for debugging - only once for the entire batch
    const modelCounts = aircraft.reduce(
      (acc, plane) => {
        const model = plane.model || 'Empty';
        acc[model] = (acc[model] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    console.log(
      `[TrackingDatabaseManager] Model distribution: ${JSON.stringify(modelCounts)}`
    );

    // Log only one sample aircraft from the entire batch
    if (aircraft.length > 0) {
      const sampleAircraft = aircraft[0];
      console.log(
        `[TrackingDatabaseManager] Aircraft ${sampleAircraft.icao24} manufacturer: "${sampleAircraft.manufacturer}", model: "${sampleAircraft.model}"`
      );
    }

    let successCount = 0;

    try {
      const db = await this.getDatabase();

      // Start a transaction for better performance and atomicity
      await db.run('BEGIN TRANSACTION');

      // Process each aircraft
      for (const plane of aircraft) {
        try {
          const {
            icao24,
            latitude,
            longitude,
            altitude,
            velocity,
            heading,
            on_ground,
            last_contact,
            manufacturer,
            model,
          } = plane;

          // Skip invalid data
          if (!icao24) {
            console.warn(
              '[TrackingDatabaseManager] Skipping aircraft with missing icao24'
            );
            continue;
          }

          // Prepare the SQL statement with explicit manufacturer and model fields
          const sql = `
          INSERT INTO tracked_aircraft 
            (icao24, latitude, longitude, altitude, velocity, heading, on_ground, last_contact, manufacturer, model, updated_at) 
          VALUES 
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(icao24) DO UPDATE SET
            latitude = ?,
            longitude = ?,
            altitude = ?,
            velocity = ?,
            heading = ?,
            on_ground = ?,
            last_contact = ?,
            manufacturer = ?,
            model = ?,
            updated_at = ?
        `;

          // Execute the statement with the manufacturer and model params included
          await db.run(sql, [
            icao24,
            latitude ?? 0,
            longitude ?? 0,
            altitude ?? 0,
            velocity ?? 0,
            heading ?? 0,
            on_ground ?? false,
            last_contact ?? Math.floor(Date.now() / 1000),
            manufacturer || 'Unknown', // Fallback to 'Unknown' if null
            model || '', // Include model field
            Date.now(),

            // Update params
            latitude ?? 0,
            longitude ?? 0,
            altitude ?? 0,
            velocity ?? 0,
            heading ?? 0,
            on_ground ?? false,
            last_contact ?? Math.floor(Date.now() / 1000),
            manufacturer || 'Unknown', // Fallback to 'Unknown' if null
            model || '', // Include model field
            Date.now(),
          ]);

          successCount++;
        } catch (aircraftError) {
          console.error(
            `[TrackingDatabaseManager] Error upserting aircraft ${plane.icao24}:`,
            aircraftError
          );
          // Continue with next aircraft
        }
      }

      // Commit the transaction
      await db.run('COMMIT');

      console.log(
        `[TrackingDatabaseManager] Successfully upserted ${successCount}/${aircraft.length} aircraft with manufacturer and model data`
      );
      return successCount;
    } catch (error) {
      // Get database first to ensure it's initialized
      const db = await this.getDatabase();

      // Rollback on error
      try {
        await db.run('ROLLBACK');
      } catch (rollbackError) {
        console.error(
          '[TrackingDatabaseManager] Error rolling back transaction:',
          rollbackError
        );
      }

      console.error(
        '[TrackingDatabaseManager] Error upserting aircraft batch:',
        error
      );
      throw error;
    }
  }

  async upsertAircraft(aircraftList: Aircraft[]) {
    const db = await this.getDatabase();

    for (const aircraft of aircraftList) {
      try {
        // Ensure model is set
        if (!aircraft.model || aircraft.model.trim() === '') {
          console.warn(
            `[TrackingDatabaseManager] ⚠️ Aircraft ${aircraft.icao24} has no model. Attempting lookup.`
          );

          // Dynamically import the staticDatabaseManager here to avoid circular dependency
          try {
            const { StaticDatabaseManager } = await import(
              './staticDatabaseManager'
            );
            const dbManager = await StaticDatabaseManager.getInstance();
            const dbModel = await dbManager.getAircraftByIcao24s([
              aircraft.icao24,
            ]);

            if (dbModel && dbModel.length > 0) {
              aircraft.model = dbModel[0].model || '';
              console.log(
                `[TrackingDatabaseManager] ✅ Set model for ${aircraft.icao24}: ${aircraft.model}`
              );
            } else {
              console.warn(
                `[TrackingDatabaseManager] ❌ No model found in DB for ${aircraft.icao24}. Using manufacturer name.`
              );
              aircraft.model = aircraft.manufacturer || ''; // Fallback to manufacturer name
            }
          } catch (error) {
            console.error(
              `[TrackingDatabaseManager] ❌ Error getting model from StaticDB:`,
              error
            );
            // Continue with empty model
            aircraft.model = aircraft.manufacturer || '';
          }
        }

        // Upsert into database, replacing old entries
        await db.run(
          `INSERT INTO tracked_aircraft (icao24, manufacturer, model, latitude, longitude, altitude, velocity, heading, on_ground, last_contact, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(icao24) DO UPDATE SET
           manufacturer = excluded.manufacturer,
           model = CASE WHEN excluded.model IS NOT NULL AND excluded.model != '' THEN excluded.model ELSE tracked_aircraft.model END,
           latitude = excluded.latitude,
           longitude = excluded.longitude,
           altitude = excluded.altitude,
           velocity = excluded.velocity,
           heading = excluded.heading,
           on_ground = excluded.on_ground,
           last_contact = excluded.last_contact,
           updated_at = excluded.updated_at;`,
          [
            aircraft.icao24,
            aircraft.manufacturer,
            aircraft.model,
            aircraft.latitude,
            aircraft.longitude,
            aircraft.altitude,
            aircraft.velocity,
            aircraft.heading,
            aircraft.on_ground ? 1 : 0,
            aircraft.last_contact,
            Date.now(),
          ]
        );
      } catch (error) {
        console.error(
          `[TrackingDatabaseManager] ❌ Error upserting ${aircraft.icao24}:`,
          error
        );
      }
    }
  }

  /**
   * Get tracked aircraft, optionally filtered by manufacturer
   */
  async getTrackedAircraft(manufacturer?: string): Promise<Aircraft[]> {
    try {
      const query = manufacturer
        ? `SELECT * FROM tracked_aircraft WHERE manufacturer = ? AND updated_at > ?`
        : `SELECT * FROM tracked_aircraft WHERE updated_at > ?`;

      const params = manufacturer
        ? [manufacturer, Date.now() - 7200000] // 2 hours in milliseconds
        : [Date.now() - 7200000];

      console.log(
        `[TrackingDatabaseManager] Getting tracked aircraft with query: ${query}`
      );
      console.log(
        `[TrackingDatabaseManager] Query params: ${JSON.stringify(params)}`
      );

      // Use executeQueryWithRetry instead of direct db.all
      const rows = await this.executeQueryWithRetry<Aircraft>(query, params);

      console.log(
        `[TrackingDatabaseManager] Found ${rows.length} tracked aircraft`
      );

      if (rows.length > 0) {
        // Log sample results
        console.log(
          `[TrackingDatabaseManager] Sample result: ${JSON.stringify(rows[0])}`
        );

        // Count manufacturers in results
        const manufacturerCounts = rows.reduce(
          (acc, row) => {
            const mfg = row.manufacturer || 'Empty';
            acc[mfg] = (acc[mfg] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

        console.log(
          `[TrackingDatabaseManager] Results manufacturer distribution: ${JSON.stringify(manufacturerCounts)}`
        );
      }

      return rows;
    } catch (error) {
      console.error(
        '[TrackingDatabaseManager] Error getting tracked aircraft:',
        error
      );
      return [];
    }
  }

  async getAircraftByIcao24(icao24: string | string[]): Promise<Aircraft[]> {
    try {
      const db = await this.getDatabase();

      // Handle both single string and array of strings
      const icao24Array = Array.isArray(icao24) ? icao24 : [icao24];

      if (icao24Array.length === 0) {
        console.log('[TrackingDatabaseManager] Empty ICAO24 list provided');
        return [];
      }

      // Create placeholders for SQL IN clause
      const placeholders = icao24Array.map(() => '?').join(',');

      const query = `SELECT * FROM tracked_aircraft WHERE icao24 IN (${placeholders})`;
      const aircraft = await db.all(query, icao24Array);

      console.log(
        `[TrackingDatabaseManager] Found ${aircraft.length} aircraft with ICAO24 codes out of ${icao24Array.length} requested`
      );

      // Log the ICAO24 codes that were found
      if (aircraft.length > 0) {
        const foundIcaos = aircraft.map((a: any) => a.icao24.toLowerCase());

        // Log which ones weren't found
        const missingIcaos = icao24Array
          .map((code) => code.toLowerCase())
          .filter((code) => !foundIcaos.includes(code));

        if (missingIcaos.length > 0) {
          const sampleMissing = [
            ...missingIcaos.slice(0, 3),
            '...',
            ...missingIcaos.slice(-3),
          ];

          console.log(
            `[TrackingDatabaseManager] Missing ICAO24s: ${sampleMissing.join(', ')} (Total: ${missingIcaos.length})`
          );
        }
      }

      return aircraft as Aircraft[];
    } catch (error) {
      console.error(
        `[TrackingDatabaseManager] Error getting aircraft by ICAO24:`,
        error
      );
      return [];
    }
  }

  /**
   * Get a single aircraft by ICAO24 code
   */
  async getSingleAircraftByIcao24(icao24: string): Promise<Aircraft | null> {
    try {
      const db = await this.getDatabase();

      const query = `SELECT * FROM tracked_aircraft WHERE icao24 = ?`;
      const aircraft = await db.get(query, [icao24]);

      if (aircraft) {
        console.log(
          `[TrackingDatabaseManager] Found aircraft with ICAO24: ${icao24}`
        );
        return aircraft as Aircraft;
      } else {
        console.log(
          `[TrackingDatabaseManager] No aircraft found with ICAO24: ${icao24}`
        );
        return null;
      }
    } catch (error) {
      console.error(
        `[TrackingDatabaseManager] Error getting single aircraft by ICAO24 ${icao24}:`,
        error
      );
      return null;
    }
  }

  public async getAll<T>(query: string): Promise<T[]> {
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      db.all(query, [], (err: Error | null, rows: T[]) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Call CleanupService for stale aircraft cleanup.
   */
  async cleanupTrackedAircraft(): Promise<number> {
    try {
      // Get the CleanupService instance and await it if it returns a Promise
      const cleanupServicePromise = CleanupService.getInstance();

      // Check if the result is a Promise or an actual instance
      const cleanupService =
        cleanupServicePromise instanceof Promise
          ? await cleanupServicePromise
          : cleanupServicePromise;

      await cleanupService.initialize();

      console.log(
        `[TrackingDatabaseManager] 🧹 Running CleanupService cleanup`
      );

      const removedCount = await cleanupService.cleanup();

      console.log(
        `[TrackingDatabaseManager] ✅ Removed ${removedCount} stale aircraft`
      );

      return removedCount;
    } catch (error) {
      console.error(
        `[TrackingDatabaseManager] ❌ Error during cleanup:`,
        error
      );
      return 0;
    }
  }

  /**
   * Perform maintenance tasks on the tracking database
   * - Marks aircraft as stale if they haven't been seen recently
   * - Removes very old aircraft data
   * @returns Object with counts of cleaned up and marked aircraft
   */
  async performMaintenance(): Promise<{ cleaned: number; marked: number }> {
    try {
      const db = await this.getDatabase();

      // Time thresholds
      const twoHoursAgo = Date.now() - 7200000; // 2 hours in milliseconds
      const oneWeekAgo = Date.now() - 604800000; // 7 days in milliseconds

      console.log('[TrackingDatabaseManager] Starting database maintenance');

      // Start a transaction
      await db.run('BEGIN TRANSACTION');

      try {
        // 1. Delete very old aircraft data (older than one week)
        const deleteResult = await db.run(
          `DELETE FROM tracked_aircraft WHERE updated_at < ?`,
          [oneWeekAgo]
        );

        const cleanedCount = deleteResult?.changes || 0;
        console.log(
          `[TrackingDatabaseManager] Removed ${cleanedCount} old aircraft records`
        );

        // 2. Mark aircraft as stale if they haven't been seen in 2 hours
        // If you have a 'status' field, you can update it here
        // For now, let's just count how many would be marked as stale
        const staleResult = await db.all(
          `SELECT COUNT(*) as count FROM tracked_aircraft WHERE updated_at < ?`,
          [twoHoursAgo]
        );

        const markedCount = staleResult[0]?.count || 0;
        console.log(
          `[TrackingDatabaseManager] Found ${markedCount} stale aircraft records`
        );

        // 3. Optimize the database
        await db.run('PRAGMA optimize');

        // Commit the transaction
        await db.run('COMMIT');

        console.log(
          '[TrackingDatabaseManager] Maintenance completed successfully'
        );

        return {
          cleaned: cleanedCount,
          marked: markedCount,
        };
      } catch (error) {
        // Rollback on error
        await db.run('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error(
        '[TrackingDatabaseManager] Error performing maintenance:',
        error
      );
      return { cleaned: 0, marked: 0 };
    }
  }

  /**
   * Clear all tracked aircraft data
   */
  async clearTrackingData(): Promise<void> {
    try {
      const db = await this.getDatabase();
      await db.run('DELETE FROM tracked_aircraft');
      console.log('[TrackingDatabaseManager] Cleared all tracking data');
    } catch (error) {
      console.error(
        '[TrackingDatabaseManager] Error clearing tracking data:',
        error
      );
      throw error;
    }
  }
}

// Export a promise-based instance to ensure initialization completes before use
const trackingDatabaseManagerPromise: Promise<TrackingDatabaseManager> =
  TrackingDatabaseManager.getInstance();

// Default export for backward compatibility, but consumers should await this promise
export default trackingDatabaseManagerPromise;
