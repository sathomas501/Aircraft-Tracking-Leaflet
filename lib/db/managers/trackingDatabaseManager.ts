// Updated TrackingDatabaseManager.ts properly extending BaseDatabaseManager

import { BaseDatabaseManager } from './baseDatabaseManager';
import { StaticDatabaseManager } from './staticDatabaseManager';
import type { Aircraft } from '@/types/base';

export class TrackingDatabaseManager extends BaseDatabaseManager {
  private static instance: TrackingDatabaseManager;

  private constructor() {
    // Call the parent constructor with the database name
    super('tracking.db');
  }

  public static getInstance(): TrackingDatabaseManager {
    if (!TrackingDatabaseManager.instance) {
      TrackingDatabaseManager.instance = new TrackingDatabaseManager();
    }
    return TrackingDatabaseManager.instance;
  }

  /**
   * Create necessary tables (implements abstract method from BaseDatabaseManager)
   */
  protected async createTables(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Create tracked_aircraft table
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
        updated_at INTEGER
      )
    `);

    // Create pending_aircraft table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS pending_aircraft (
        icao24 TEXT PRIMARY KEY,
        latitude REAL,
        longitude REAL,
        altitude REAL,
        velocity REAL,
        heading REAL,
        on_ground INTEGER,
        last_contact INTEGER,
        manufacturer TEXT,
        priority INTEGER DEFAULT 0,
        added_at INTEGER
      )
    `);

    // Add any other tables or indexes as needed
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
   * Get pending ICAO24 codes for a manufacturer
   */
  async getPendingIcao24s(manufacturer: string): Promise<string[]> {
    try {
      const query = `
      SELECT icao24 FROM pending_aircraft 
      WHERE manufacturer = ?
    `;

      const results = await this.executeQuery<{ icao24: string }>(query, [
        manufacturer,
      ]);

      return results.map((r) => r.icao24);
    } catch (error) {
      console.error(
        `[TrackingDatabaseManager] Error getting pending ICAO24s:`,
        error
      );
      return [];
    }
  }

  /**
   * Get stale ICAO24 codes for a manufacturer
   */
  async getStaleIcao24s(manufacturer: string): Promise<string[]> {
    try {
      const twoHoursAgo = Date.now() - 7200000; // 2 hours in milliseconds
      const twentyFourHoursAgo = Date.now() - 86400000; // 24 hours in milliseconds

      const query = `
      SELECT icao24 FROM tracked_aircraft 
      WHERE manufacturer = ? AND updated_at <= ? AND updated_at > ?
    `;

      const results = await this.executeQuery<{ icao24: string }>(query, [
        manufacturer,
        twoHoursAgo,
        twentyFourHoursAgo,
      ]);

      return results.map((r) => r.icao24);
    } catch (error) {
      console.error(
        `[TrackingDatabaseManager] Error getting stale ICAO24s:`,
        error
      );
      return [];
    }
  }

  /**
   * Update status of tracked aircraft (mark old ones as stale)
   */
  async updateAircraftStatus(): Promise<void> {
    if (!this.db) {
      console.error(
        '[TrackingDatabaseManager] ❌ Database is not initialized.'
      );
      return;
    }

    try {
      const now = Date.now();
      const threshold = now - 5 * 60 * 1000; // 5 minutes ago

      await this.db.run(
        `UPDATE tracked_aircraft 
       SET status = 'active' 
       WHERE last_contact > ?`,
        [threshold]
      );

      await this.db.run(
        `UPDATE tracked_aircraft 
       SET status = 'stale' 
       WHERE last_contact <= ? AND status != 'pending'`,
        [threshold]
      );

      console.log(`[TrackingDatabaseManager] ✅ Updated aircraft status.`);
    } catch (error) {
      console.error(
        `[TrackingDatabaseManager] ❌ Error updating aircraft status:`,
        error
      );
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
  ): Promise<boolean> {
    try {
      if (!icao24) {
        console.warn(
          '[TrackingDatabaseManager] Missing ICAO24 for position update'
        );
        return false;
      }

      const db = await this.getDatabase();

      // Validate coordinates
      if (isNaN(latitude) || isNaN(longitude)) {
        console.warn(
          `[TrackingDatabaseManager] Invalid coordinates for ${icao24}: ${latitude}, ${longitude}`
        );
        return false;
      }

      console.log(
        `[TrackingDatabaseManager] Updating position for ${icao24}: LAT=${latitude}, LON=${longitude}, HDG=${heading}`
      );

      // Update the position
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
        Math.floor(Date.now() / 1000), // Current time as Unix timestamp
        Date.now(), // Current time as milliseconds
        icao24,
      ]);

      const success = result?.changes ? result.changes > 0 : false;

      if (success) {
        console.log(
          `[TrackingDatabaseManager] ✅ Position updated for ${icao24}`
        );
      } else {
        console.log(
          `[TrackingDatabaseManager] ⚠️ No aircraft found for ${icao24}, position not updated`
        );
      }

      return success;
    } catch (error) {
      console.error(
        `[TrackingDatabaseManager] ❌ Error updating position for ${icao24}:`,
        error
      );
      return false;
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
        // 🚀 Ensure model is set
        if (!aircraft.model || aircraft.model.trim() === '') {
          console.warn(
            `[TrackingDatabaseManager] ⚠️ Aircraft ${aircraft.icao24} has no model. Attempting lookup.`
          );

          const dbManager = StaticDatabaseManager.getInstance();
          const dbModel = await dbManager.getAircraftByIcao24s([
            aircraft.icao24,
          ]);

          if (dbModel) {
            aircraft.model = dbModel.length > 0 ? dbModel[0].model : '';
            console.log(
              `[TrackingDatabaseManager] ✅ Set model for ${aircraft.icao24}: ${dbModel}`
            );
          } else {
            console.warn(
              `[TrackingDatabaseManager] ❌ No model found in DB for ${aircraft.icao24}. Using manufacturer name.`
            );
            aircraft.model = aircraft.manufacturer; // Fallback to manufacturer name
          }
        }

        // 🔄 Upsert into database, replacing old entries
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
      const db = await this.getDatabase();

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

      const rows = await db.all(query, params);

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

      return rows as Aircraft[];
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

  /**
   * Add aircraft to pending list for tracking
   */
  async addPendingAircraft(
    aircraftOrIcao24s: Aircraft | Aircraft[] | string | string[],
    manufacturer?: string
  ): Promise<number> {
    try {
      // Handle different input types
      let aircraftArray: Aircraft[] = [];

      // Check if input is string or string[] (ICAO24 codes)
      if (typeof aircraftOrIcao24s === 'string') {
        // Single ICAO24 string
        console.log(
          `[TrackingDatabaseManager] Converting single ICAO24 code to pending aircraft`
        );

        aircraftArray = [
          {
            icao24: aircraftOrIcao24s,
            manufacturer: manufacturer || 'Unknown',
            latitude: 0,
            longitude: 0,
            altitude: 0,
            velocity: 0,
            heading: 0,
            on_ground: false,
            last_contact: Math.floor(Date.now() / 1000),
            'N-NUMBER': '',
            model: '',
            operator: '',
            NAME: '',
            CITY: '',
            STATE: '',
            TYPE_AIRCRAFT: '',
            OWNER_TYPE: '',
            isTracked: true,
            lastSeen: Date.now(),
          },
        ];
      } else if (Array.isArray(aircraftOrIcao24s)) {
        // Array type - could be string[] or Aircraft[]
        if (aircraftOrIcao24s.length === 0) {
          // Empty array
          console.log(
            '[TrackingDatabaseManager] Empty array provided to addPendingAircraft'
          );
          return 0;
        }

        if (typeof aircraftOrIcao24s[0] === 'string') {
          // It's a string array (ICAO24 codes)
          const icao24Array = aircraftOrIcao24s as string[];

          console.log(
            `[TrackingDatabaseManager] Converting ${icao24Array.length} ICAO24 codes to pending aircraft`
          );

          // Create minimal aircraft objects from ICAO24 codes
          aircraftArray = icao24Array.map((icao24) => ({
            icao24,
            manufacturer: manufacturer || 'Unknown',
            latitude: 0,
            longitude: 0,
            altitude: 0,
            velocity: 0,
            heading: 0,
            on_ground: false,
            last_contact: Math.floor(Date.now() / 1000),
            'N-NUMBER': '',
            model: '',
            operator: '',
            NAME: '',
            CITY: '',
            STATE: '',
            TYPE_AIRCRAFT: '',
            OWNER_TYPE: '',
            isTracked: true,
            lastSeen: Date.now(),
          }));
        } else {
          // It's an Aircraft array
          const typedAircraftArray = aircraftOrIcao24s as Aircraft[];

          console.log(
            `[TrackingDatabaseManager] Processing ${typedAircraftArray.length} Aircraft objects`
          );

          // If manufacturer is provided, apply it to aircraft that don't have one
          if (manufacturer) {
            aircraftArray = typedAircraftArray.map((aircraft) => ({
              ...aircraft,
              manufacturer: aircraft.manufacturer || manufacturer,
            }));
          } else {
            aircraftArray = typedAircraftArray;
          }
        }
      } else {
        // Single Aircraft object
        const aircraft = aircraftOrIcao24s as Aircraft;

        console.log(
          `[TrackingDatabaseManager] Processing single Aircraft object`
        );

        // Apply manufacturer if needed
        if (manufacturer && !aircraft.manufacturer) {
          aircraftArray = [
            {
              ...aircraft,
              manufacturer,
            },
          ];
        } else {
          aircraftArray = [aircraft];
        }
      }

      if (aircraftArray.length === 0) {
        console.log('[TrackingDatabaseManager] No pending aircraft to add');
        return 0;
      }

      console.log(
        `[TrackingDatabaseManager] Adding ${aircraftArray.length} aircraft to pending list`
      );

      const db = await this.getDatabase();

      // Start a transaction
      await db.run('BEGIN TRANSACTION');

      let successCount = 0;
      let errorCount = 0;
      let firstError: Error | null = null;

      // Add each aircraft to pending list
      for (const plane of aircraftArray) {
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
            manufacturer: planeManufacturer,
          } = plane;

          // Skip invalid data
          if (!icao24) {
            console.warn(
              '[TrackingDatabaseManager] Skipping pending aircraft with missing icao24'
            );
            continue;
          }

          // Use the aircraft's manufacturer or the provided one
          const finalManufacturer =
            planeManufacturer || manufacturer || 'Unknown';

          // Insert or update the pending aircraft
          const sql = `
          INSERT INTO pending_aircraft 
            (icao24, latitude, longitude, altitude, velocity, heading, on_ground, last_contact, manufacturer, priority, added_at) 
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
            added_at = ?
        `;

          const currentTime = Date.now();

          await db.run(sql, [
            icao24,
            latitude ?? 0,
            longitude ?? 0,
            altitude ?? 0,
            velocity ?? 0,
            heading ?? 0,
            on_ground ?? false,
            last_contact ?? Math.floor(currentTime / 1000),
            finalManufacturer,
            0, // priority
            currentTime,

            // Update params
            latitude ?? 0,
            longitude ?? 0,
            altitude ?? 0,
            velocity ?? 0,
            heading ?? 0,
            on_ground ?? false,
            last_contact ?? Math.floor(currentTime / 1000),
            finalManufacturer,
            currentTime,
          ]);

          successCount++;
        } catch (error) {
          errorCount++;
          if (!firstError) {
            firstError = error as Error;
          }
        }
      }

      // Log a single error message if any errors occurred
      if (errorCount > 0) {
        console.error(
          `[TrackingDatabaseManager] ❌ Failed to add ${errorCount} aircraft due to error:`,
          firstError
        );
      }

      // Commit the transaction
      await db.run('COMMIT');

      console.log(
        `[TrackingDatabaseManager] Successfully added ${successCount}/${aircraftArray.length} aircraft to pending list`
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
        '[TrackingDatabaseManager] Error adding pending aircraft:',
        error
      );
      return 0;
    }
  }

  /**
   * Get all pending aircraft
   */
  async getPendingAircraft(): Promise<Aircraft[]> {
    try {
      const db = await this.getDatabase();

      const query = `SELECT * FROM pending_aircraft ORDER BY priority DESC, added_at ASC`;
      const aircraft = await db.all(query);

      console.log(
        `[TrackingDatabaseManager] Found ${aircraft.length} pending aircraft`
      );

      return aircraft as Aircraft[];
    } catch (error) {
      console.error(
        '[TrackingDatabaseManager] Error getting pending aircraft:',
        error
      );
      return [];
    }
  }

  async getPreviouslyFetchedIcaos(icao24s: string[]): Promise<string[]> {
    try {
      const db = await this.getDatabase();

      if (!db) {
        console.error(
          '[TrackingDatabaseManager] ❌ Database is not initialized.'
        );
        return [];
      }

      if (icao24s.length === 0) {
        return [];
      }

      // Generate dynamic placeholders (?, ?, ?, ...) for the query
      const placeholders = icao24s.map(() => '?').join(', ');
      const query = `SELECT DISTINCT icao24 FROM tracked_aircraft WHERE icao24 IN (${placeholders})`;

      console.log(
        `[TrackingDatabaseManager] 🔍 Checking already fetched ICAO24s with query: ${query}`
      );

      const rows = (await db.all(query, icao24s)) ?? [];

      const fetchedIcaos = rows.map((row) => row.icao24);

      console.log(
        `[TrackingDatabaseManager] ✅ Found ${fetchedIcaos.length} previously fetched ICAO24s`
      );

      return fetchedIcaos;
    } catch (error) {
      console.error(
        '[TrackingDatabaseManager] ❌ Error fetching previously fetched ICAO24s:',
        error
      );
      return [];
    }
  }

  /**
   * Remove aircraft from pending list
   */
  async removePendingAircraft(icao24: string | string[]): Promise<number> {
    try {
      const db = await this.getDatabase();

      // Convert to array if string
      const icao24Array = Array.isArray(icao24) ? icao24 : [icao24];

      if (icao24Array.length === 0) {
        return 0;
      }

      // Create placeholders for SQL IN clause
      const placeholders = icao24Array.map(() => '?').join(',');

      // Delete the records
      const result = await db.run(
        `DELETE FROM pending_aircraft WHERE icao24 IN (${placeholders})`,
        icao24Array
      );

      const count = result.changes || 0;
      console.log(
        `[TrackingDatabaseManager] Removed ${count} aircraft from pending list`
      );

      return count;
    } catch (error) {
      console.error(
        '[TrackingDatabaseManager] Error removing pending aircraft:',
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

  // Add a new method to TrackingDatabaseManager
  async cleanupManufacturerAircraft(manufacturer: string): Promise<number> {
    try {
      const db = await this.getDatabase();
      const twoHoursAgo = Date.now() - 7200000; // 2 hours in milliseconds

      console.log(
        `[TrackingDatabaseManager] Cleaning up stale ${manufacturer} aircraft older than 2 hours`
      );

      // Delete stale aircraft for this specific manufacturer
      const result = await db.run(
        `DELETE FROM tracked_aircraft 
       WHERE manufacturer = ? AND updated_at < ?`,
        [manufacturer, twoHoursAgo]
      );

      const deletedCount = result?.changes || 0;
      console.log(
        `[TrackingDatabaseManager] ✅ Removed ${deletedCount} stale ${manufacturer} aircraft`
      );

      return deletedCount;
    } catch (error) {
      console.error(
        `[TrackingDatabaseManager] ❌ Error cleaning up ${manufacturer} aircraft:`,
        error
      );
      return 0;
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

// Export default instance for backward compatibility
const trackingDatabaseManager = TrackingDatabaseManager.getInstance();
export default trackingDatabaseManager;
