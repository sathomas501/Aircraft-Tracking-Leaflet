import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';
import { Aircraft } from '@/types/base';
import { normalizeAircraft } from '@/utils/aircraft-transform1';

class TrackingDatabaseManager {
  private static instance: TrackingDatabaseManager;
  private db: Database | null = null;

  private readonly STALE_THRESHOLD: number = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

  private readonly REQUIRED_COLUMNS: Record<string, string> = {
    icao24: 'TEXT PRIMARY KEY',
    latitude: 'REAL',
    longitude: 'REAL',
    altitude: 'REAL',
    velocity: 'REAL',
    heading: 'REAL',
    on_ground: 'INTEGER',
    last_contact: 'INTEGER',
    updated_at: "INTEGER DEFAULT (strftime('%s', 'now'))",
  };

  private constructor() {
    if (typeof window !== 'undefined') {
      throw new Error(
        'Database operations are not allowed on the client-side.'
      );
    }
    this.initialize();
  }

  /** ✅ Get or create singleton instance */
  public static getInstance(): TrackingDatabaseManager {
    if (!TrackingDatabaseManager.instance) {
      TrackingDatabaseManager.instance = new TrackingDatabaseManager();
    }
    return TrackingDatabaseManager.instance;
  }

  /** ✅ Initialize database connection */
  public async initialize(): Promise<void> {
    if (typeof window !== 'undefined') {
      throw new Error(
        '[TrackingDatabaseManager] ❌ Cannot initialize on the client side.'
      );
    }

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database('tracking.db', (err) => {
        if (err) {
          console.error(
            '[TrackingDatabaseManager] ❌ Database connection failed:',
            err
          );
          reject(err);
        } else {
          console.log('[TrackingDatabaseManager] ✅ Database connected.');
          this.validateSchema().then(resolve).catch(reject);
        }
      });
    });
  }

  /** ✅ Validate schema & auto-fix missing columns */
  public async validateSchema(): Promise<void> {
    if (!this.db) {
      console.error(
        '[TrackingDatabaseManager] ❌ Database is not initialized.'
      );
      return;
    }

    try {
      const rows: any[] = await new Promise((resolve, reject) => {
        this.db!.all('PRAGMA table_info(tracked_aircraft);', (err, rows) => {
          if (err) {
            console.error(
              '[TrackingDatabaseManager] ❌ Schema check failed:',
              err
            );
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });

      const existingColumns = new Set(rows.map((row: any) => row.name));
      const missingColumns = Object.keys(this.REQUIRED_COLUMNS).filter(
        (column) => !existingColumns.has(column)
      );

      if (rows.length === 0) {
        console.log(
          '[TrackingDatabaseManager] ❗ Table does not exist. Creating...'
        );
        await this.createTable();
        return;
      }

      if (missingColumns.length === 0) {
        console.log('[TrackingDatabaseManager] ✅ Schema is up to date.');
        return;
      }

      console.log(
        `[TrackingDatabaseManager] ⚠️ Missing columns: ${missingColumns.join(', ')}`
      );

      if (existingColumns.size < 3) {
        console.log(
          '[TrackingDatabaseManager] ❗ Too many missing columns. Dropping and recreating table.'
        );
        await this.recreateTable();
      } else {
        await this.addMissingColumns(missingColumns);
      }

      console.log('[TrackingDatabaseManager] ✅ Schema validation complete.');
    } catch (error) {
      console.error(
        '[TrackingDatabaseManager] ❌ Schema validation failed:',
        error
      );
    }
  }

  /** ✅ Create a fresh tracking table */
  private createTable(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject('[TrackingDatabaseManager] ❌ Database is not initialized.');
        return;
      }

      const columnDefinitions = Object.entries(this.REQUIRED_COLUMNS)
        .map(([name, type]) => `${name} ${type}`)
        .join(', ');

      this.db.run(
        `CREATE TABLE tracked_aircraft (${columnDefinitions});`,
        (err) => {
          if (err) {
            console.error(
              '[TrackingDatabaseManager] ❌ Table creation failed:',
              err
            );
            reject(err);
          } else {
            console.log(
              '[TrackingDatabaseManager] ✅ Table created successfully.'
            );
            resolve();
          }
        }
      );
    });
  }

  /** ✅ Drop & recreate table if schema is incorrect */
  private async recreateTable(): Promise<void> {
    if (!this.db)
      throw new Error(
        '[TrackingDatabaseManager] ❌ Database is not initialized.'
      );

    console.log(
      '[TrackingDatabaseManager] 🔄 Dropping and recreating table...'
    );

    await new Promise((resolve, reject) => {
      this.db!.run('DROP TABLE IF EXISTS tracked_aircraft;', (err) => {
        if (err) {
          console.error(
            '[TrackingDatabaseManager] ❌ Failed to drop table:',
            err
          );
          reject(err);
        } else {
          resolve(null);
        }
      });
    });

    await this.createTable();
  }

  /** ✅ Dynamically add missing columns */
  private async addMissingColumns(missingColumns: string[]): Promise<void> {
    if (!this.db)
      throw new Error(
        '[TrackingDatabaseManager] ❌ Database is not initialized.'
      );

    for (const column of missingColumns) {
      const columnType = this.REQUIRED_COLUMNS[column];

      await new Promise((resolve, reject) => {
        this.db!.run(
          `ALTER TABLE tracked_aircraft ADD COLUMN ${column} ${columnType};`,
          (err) => {
            if (err) {
              console.error(
                `[TrackingDatabaseManager] ❌ Failed to add column '${column}':`,
                err
              );
              reject(err);
            } else {
              console.log(
                `[TrackingDatabaseManager] ✅ Added column '${column}'.`
              );
              resolve(null);
            }
          }
        );
      });
    }
  }

  public async executeQuery(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject(new Error('Database is not initialized.'));
      }
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('Database query error:', err);
          return reject(err);
        }
        resolve(rows);
      });
    });
  }

  public async getTrackedAircraft(): Promise<any[]> {
    if (!this.db)
      throw new Error('[TrackingDatabaseManager] Database not initialized.');

    return new Promise((resolve, reject) => {
      this.db!.all('SELECT * FROM tracked_aircraft', (err, rows) => {
        if (err) {
          console.error(
            '[TrackingDatabaseManager] Error retrieving aircraft:',
            err
          );
          return reject(err);
        }
        resolve(rows);
      });
    });
  }

  public async getTrackedAircraftByICAOs(
    icao24s: string[]
  ): Promise<Aircraft[]> {
    if (!this.db) {
      console.error('[TrackingDatabaseManager] ❌ Database not initialized.');
      return [];
    }

    if (!icao24s || icao24s.length === 0) {
      console.warn(
        '[TrackingDatabaseManager] ⚠️ No ICAO24s provided for tracking.'
      );
      return [];
    }

    const formattedIcaos = icao24s.map((icao) => icao.toLowerCase());

    console.log(
      `[TrackingDatabaseManager] 🔍 Querying DB for ICAO24s:`,
      formattedIcaos
    );

    const query = `
    SELECT * FROM tracked_aircraft 
    WHERE LOWER(icao24) IN (${formattedIcaos.map(() => '?').join(', ')})
  `;

    return new Promise((resolve, reject) => {
      this.db?.all(query, formattedIcaos, (err, rows: any[]) => {
        if (err) {
          console.error(
            `[TrackingDatabaseManager] ❌ Error fetching tracked aircraft:`,
            err
          );
          reject(err);
        } else {
          console.log(
            `[TrackingDatabaseManager] ✅ Found ${rows.length} tracked aircraft.`
          );
          resolve(rows);
        }
      });
    });
  }

  public async upsertLiveAircraftBatch(aircraft: Aircraft[]) {
    if (!this.db) {
      console.error('[TrackingDatabaseManager] ❌ Database not initialized.');
      return;
    }

    const query = `
    INSERT INTO tracked_aircraft (icao24, latitude, longitude, altitude, velocity, heading, on_ground, last_contact, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(icao24) DO UPDATE SET
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      altitude = excluded.altitude,
      velocity = excluded.velocity,
      heading = excluded.heading,
      on_ground = excluded.on_ground,
      last_contact = excluded.last_contact,
      updated_at = excluded.updated_at;
  `;

    const stmt = this.db.prepare(query);
    for (const ac of aircraft) {
      try {
        await stmt.run([
          ac.icao24,
          ac.latitude,
          ac.longitude,
          ac.altitude,
          ac.velocity,
          ac.heading,
          ac.on_ground,
          ac.last_contact,
          Date.now(),
        ]);
        console.log(
          `[TrackingDatabaseManager] ✅ Upserted ${ac.icao24} successfully.`
        );
      } catch (error) {
        console.error(
          `[TrackingDatabaseManager] ❌ Upsert failed for ${ac.icao24}:`,
          error
        );
      }
    }
  }

  public async getLiveAircraftData(): Promise<Aircraft[]> {
    if (!this.db) {
      console.error('[TrackingDatabaseManager] ❌ Database not initialized.');
      return [];
    }

    const query = `SELECT icao24, latitude, longitude, altitude, velocity, heading, on_ground, last_contact, updated_at FROM tracked_aircraft`;

    return new Promise((resolve, reject) => {
      this.db?.all(query, [], (err, rows: any[]) => {
        if (err) {
          console.error(
            '[TrackingDatabaseManager] ❌ Error fetching live aircraft data:',
            err
          );
          reject(err);
        } else {
          // ✅ Ensure all required Aircraft fields exist using `normalizeAircraft`
          const aircraftData: Aircraft[] = rows.map((row) =>
            normalizeAircraft({
              icao24: row.icao24,
              latitude: row.latitude,
              longitude: row.longitude,
              altitude: row.altitude,
              velocity: row.velocity,
              heading: row.heading,
              on_ground: row.on_ground,
              last_contact: row.last_contact,
            })
          );

          resolve(aircraftData);
        }
      });
    });
  }

  public async updateAircraftPosition(
    icao24: string,
    latitude: number,
    longitude: number,
    heading: number
  ) {
    if (!this.db) {
      console.error('[TrackingDatabaseManager] ❌ Database not initialized.');
      return;
    }

    const query = `
      INSERT INTO tracked_aircraft (icao24, latitude, longitude, heading, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(icao24) DO UPDATE SET
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        heading = excluded.heading,
        updated_at = excluded.updated_at;
    `;

    try {
      await this.db?.run(query, [
        icao24,
        latitude,
        longitude,
        heading,
        Date.now(),
      ]);
      console.log(
        `[TrackingDatabaseManager] ✅ Upserted position for aircraft ${icao24}`
      );
    } catch (error) {
      console.error(
        `[TrackingDatabaseManager] ❌ Database update failed for ${icao24}:`,
        error
      );
    }
  }

  public async deleteAircraft(icao24: string): Promise<void> {
    if (!this.db)
      throw new Error('[TrackingDatabaseManager] Database not initialized.');

    return new Promise((resolve, reject) => {
      this.db!.run(
        `DELETE FROM tracked_aircraft WHERE icao24 = ?`,
        [icao24],
        (err) => {
          if (err) {
            console.error(
              `[TrackingDatabaseManager] Failed to delete ${icao24}:`,
              err
            );
            return reject(err);
          }
          console.log(`[TrackingDatabaseManager] Deleted aircraft ${icao24}.`);
          resolve();
        }
      );
    });
  }

  public cleanStaleRecords(): void {
    if (!this.db) return;

    const thresholdTime = Date.now() - this.STALE_THRESHOLD;
    this.db.run(
      `DELETE FROM aircraft WHERE last_seen < ?`,
      [thresholdTime],
      (err) => {
        if (err) {
          console.error('Error cleaning stale records:', err);
        } else {
          console.log('Stale records cleaned successfully.');
        }
      }
    );
  }

  public async clearTrackingData(): Promise<void> {
    if (!this.db)
      throw new Error('[TrackingDatabaseManager] Database not initialized.');

    return new Promise((resolve, reject) => {
      this.db!.run(`DELETE FROM tracked_aircraft`, (err) => {
        if (err) {
          console.error(
            '[TrackingDatabaseManager] Failed to clear tracking data:',
            err
          );
          return reject(err);
        }
        console.log('[TrackingDatabaseManager] Cleared all tracking data.');
        resolve();
      });
    });
  }

  /** ✅ Close database safely */
  public stop(): void {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error(
            '[TrackingDatabaseManager] ❌ Error closing database:',
            err
          );
        } else {
          console.log('[TrackingDatabaseManager] ✅ Database closed.');
          this.db = null; // ✅ Only nullify on successful close
        }
      });
    }
  }
}

// 🚀 Singleton instance, only created when needed
const trackingDatabaseManager = TrackingDatabaseManager.getInstance();
export default trackingDatabaseManager;
export { TrackingDatabaseManager };
