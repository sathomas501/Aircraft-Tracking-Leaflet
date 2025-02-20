// lib/db/trackingDatabase.ts
import { BaseDatabaseManager } from './managers/baseDatabaseManager';
import { Aircraft } from '@/types/base';

export class TrackingDatabaseManager extends BaseDatabaseManager {
  private static instance: TrackingDatabaseManager | null = null;

  private constructor() {
    super('tracking.db');
  }

  public static getInstance(): TrackingDatabaseManager {
    if (!TrackingDatabaseManager.instance) {
      TrackingDatabaseManager.instance = new TrackingDatabaseManager();
    }
    return TrackingDatabaseManager.instance;
  }

  // Implementation of abstract method from base class
  protected async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

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
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

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
        last_seen TIMESTAMP,
        TYPE_AIRCRAFT TEXT DEFAULT 'default',
        N_NUMBER TEXT,
        OWNER_TYPE TEXT,
        updated_at INTEGER,
        created_at INTEGER
      );
    `);
  }

  // Public methods that use the protected ensureInitialized from base class
  public async updatePosition(
    icao24: string,
    latitude: number,
    longitude: number,
    heading?: number
  ): Promise<void> {
    await this.initializeDatabase(); // Using public method from base class

    try {
      await this.executeQuery(
        `UPDATE tracked_aircraft
         SET latitude = ?,
             longitude = ?,
             heading = ?,
             updated_at = strftime('%s', 'now')
         WHERE icao24 = ?`,
        [latitude, longitude, heading || 0, icao24]
      );
    } catch (error) {
      console.error(`Failed to update position for ${icao24}:`, error);
      throw error;
    }
  }

  public async upsertLiveAircraft(aircraftData: Aircraft[]): Promise<void> {
    await this.initializeDatabase(); // Using public method from base class

    const sql = `
      INSERT OR REPLACE INTO tracked_aircraft (
        icao24, latitude, longitude, altitude, velocity, 
        heading, on_ground, last_contact, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
    `;

    for (const aircraft of aircraftData) {
      await this.executeQuery(sql, [
        aircraft.icao24,
        aircraft.latitude,
        aircraft.longitude,
        aircraft.altitude || 0,
        aircraft.velocity || 0,
        aircraft.heading || 0,
        aircraft.on_ground ? 1 : 0,
        aircraft.last_contact || Math.floor(Date.now() / 1000),
      ]);
    }
  }

  public async getTrackedAircraft(): Promise<Aircraft[]> {
    await this.initializeDatabase(); // Using public method from base class
    return this.executeQuery('SELECT * FROM tracked_aircraft');
  }

  public async deleteAircraft(icao24: string): Promise<void> {
    await this.initializeDatabase(); // Using public method from base class
    await this.executeQuery('DELETE FROM tracked_aircraft WHERE icao24 = ?', [
      icao24,
    ]);
  }
}

export default TrackingDatabaseManager;
