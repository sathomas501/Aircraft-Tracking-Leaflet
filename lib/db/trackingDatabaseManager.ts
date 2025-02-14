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

  /** ✅ Validate schema & auto-fix missing tables */
  public async validateSchema(): Promise<void> {
    if (!this.db) {
      console.error(
        '[TrackingDatabaseManager] ❌ Database is not initialized.'
      );
      return;
    }

    try {
      // ✅ Check `tracked_aircraft` table
      const trackedExists = await this.checkTableExists('tracked_aircraft');
      if (!trackedExists) {
        console.log(
          '[TrackingDatabaseManager] ❗ `tracked_aircraft` does not exist. Creating...'
        );
        await this.createTrackedAircraftTable();
      }

      // ✅ Check `active_tracking` table
      const activeExists = await this.checkTableExists('active_tracking');
      if (!activeExists) {
        console.log(
          '[TrackingDatabaseManager] ❗ `active_tracking` does not exist. Creating...'
        );
        await this.createActiveTrackingTable();
      }

      console.log('[TrackingDatabaseManager] ✅ Schema validation complete.');
    } catch (error) {
      console.error(
        '[TrackingDatabaseManager] ❌ Schema validation failed:',
        error
      );
    }
  }

  /** ✅ Check if a table exists in the database */
  private async checkTableExists(tableName: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db!.get(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?;`,
        [tableName],
        (err, row) => {
          if (err) {
            console.error(
              `[TrackingDatabaseManager] ❌ Failed to check table '${tableName}':`,
              err
            );
            reject(err);
          } else {
            resolve(!!row);
          }
        }
      );
    });
  }

  /** ✅ Create `active_tracking` table */
  private async createActiveTrackingTable(): Promise<void> {
    if (!this.db) {
      console.error(
        '[TrackingDatabaseManager] ❌ Database is not initialized.'
      );
      return;
    }

    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS active_tracking (
            icao24 TEXT PRIMARY KEY,
            manufacturer TEXT NOT NULL,
            model TEXT,
            marker TEXT,
            latitude REAL,
            longitude REAL,
            altitude REAL,
            velocity REAL,
            heading REAL,
            on_ground BOOLEAN,
            last_contact TIMESTAMP,
            last_seen TIMESTAMP
        );
    `;

    return new Promise((resolve, reject) => {
      this.db!.run(createTableSQL, (err) => {
        if (err) {
          console.error(
            '[TrackingDatabaseManager] ❌ Failed to create `active_tracking`:',
            err
          );
          reject(err);
        } else {
          console.log(
            '[TrackingDatabaseManager] ✅ `active_tracking` table created.'
          );
          resolve();
        }
      });
    });
  }

  /** ✅ Create `tracked_aircraft` table */
  private async createTrackedAircraftTable(): Promise<void> {
    if (!this.db) {
      console.error(
        '[TrackingDatabaseManager] ❌ Database is not initialized.'
      );
      return;
    }

    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS tracked_aircraft (
            icao24 TEXT PRIMARY KEY,
            latitude REAL,
            longitude REAL,
            altitude REAL,
            velocity REAL,
            heading REAL,
            on_ground INTEGER,
            last_contact INTEGER,
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
    `;

    return new Promise((resolve, reject) => {
      this.db!.run(createTableSQL, (err) => {
        if (err) {
          console.error(
            '[TrackingDatabaseManager] ❌ Failed to create `tracked_aircraft`:',
            err
          );
          reject(err);
        } else {
          console.log(
            '[TrackingDatabaseManager] ✅ `tracked_aircraft` table created.'
          );
          resolve();
        }
      });
    });
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
        console.error('❌ Database is not initialized.');
        return reject(new Error('Database is not initialized.'));
      }

      console.log(
        `[SQL] Executing query: ${sql} with params: ${JSON.stringify(params)}`
      );

      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('❌ SQL Error:', err);
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

    try {
      await this.db.run('BEGIN TRANSACTION');

      for (const ac of aircraft) {
        console.log(
          `[TrackingDatabaseManager] 🚀 Inserting into active_tracking for ICAO24: ${ac.icao24}`
        );

        // Insert into tracked_aircraft
        await this.executeQuery(
          `INSERT INTO tracked_aircraft (
                    icao24, latitude, longitude, altitude, velocity, heading, on_ground, last_contact, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(icao24) DO UPDATE SET
                    latitude = excluded.latitude,
                    longitude = excluded.longitude,
                    altitude = excluded.altitude,
                    velocity = excluded.velocity,
                    heading = excluded.heading,
                    on_ground = excluded.on_ground,
                    last_contact = excluded.last_contact,
                    updated_at = excluded.updated_at;`,
          [
            ac.icao24,
            ac.latitude || 0,
            ac.longitude || 0,
            ac.altitude || 0,
            ac.velocity || 0,
            ac.heading || 0,
            ac.on_ground ? 1 : 0,
            ac.last_contact || Math.floor(Date.now() / 1000),
            Date.now(),
          ]
        );

        // Insert into active_tracking
        await this.executeQuery(
          `INSERT INTO active_tracking (
                    icao24, manufacturer, model, marker, latitude, longitude, altitude, velocity, heading, on_ground, last_contact
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(icao24) DO UPDATE SET
                    latitude = excluded.latitude,
                    longitude = excluded.longitude,
                    altitude = excluded.altitude,
                    velocity = excluded.velocity,
                    heading = excluded.heading,
                    on_ground = excluded.on_ground,
                    last_contact = excluded.last_contact;`,
          [
            ac.icao24,
            ac.manufacturer || '',
            ac.model || '',
            ac['N-NUMBER'] || '', // Using N-NUMBER as marker
            ac.latitude || 0,
            ac.longitude || 0,
            ac.altitude || 0,
            ac.velocity || 0,
            ac.heading || 0,
            ac.on_ground ? 1 : 0,
            ac.last_contact || Math.floor(Date.now() / 1000),
          ]
        );
      }

      await this.db.run('COMMIT');
      console.log(
        `[TrackingDatabaseManager] ✅ Successfully upserted ${aircraft.length} aircraft`
      );
    } catch (error) {
      console.error('[TrackingDatabaseManager] ❌ Transaction failed:', error);
      await this.db.run('ROLLBACK');
      throw error;
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
