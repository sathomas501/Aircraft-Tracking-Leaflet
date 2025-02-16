// File: pages/api/tracking/db.ts
import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';
import path from 'path';

class DatabaseConnection {
  private static instance: Database | null = null;
  private static DB_PATH = path.join(process.cwd(), 'lib', 'db', 'tracking.db');

  static async getInstance(): Promise<Database> {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = await new Promise<Database>(
        (resolve, reject) => {
          const db = new sqlite3.Database(DatabaseConnection.DB_PATH, (err) => {
            if (err) {
              console.error('Failed to connect to database:', err);
              reject(err);
            } else {
              if (!db) {
                reject(new Error('Failed to create database instance'));
              } else {
                resolve(db);
              }
            }
          });
        }
      );
    }

    if (!DatabaseConnection.instance) {
      throw new Error('Failed to initialize database connection');
    }

    return DatabaseConnection.instance;
  }

  static async executeQuery(sql: string, params: any[] = []): Promise<any> {
    const db = await DatabaseConnection.getInstance();
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

// Utility functions for database operations
async function initializeTables(db: Database) {
  const trackedAircraftTable = `
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

  const activeTrackingTable = `
    CREATE TABLE IF NOT EXISTS active_tracking (
      icao24 TEXT PRIMARY KEY,
      manufacturer TEXT,
      model TEXT,
      marker TEXT,
      latitude REAL NOT NULL DEFAULT 0,
      longitude REAL NOT NULL DEFAULT 0,
      altitude REAL DEFAULT 0,
      velocity REAL DEFAULT 0,
      heading REAL DEFAULT 0,
      on_ground INTEGER DEFAULT 0,
      last_contact INTEGER,
      last_seen INTEGER,
      TYPE_AIRCRAFT TEXT,
      "N-NUMBER" TEXT,
      OWNER_TYPE TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      CONSTRAINT valid_coordinates CHECK (
        latitude BETWEEN -90 AND 90 AND 
        longitude BETWEEN -180 AND 180
      ),
      CONSTRAINT valid_heading CHECK (
        heading BETWEEN 0 AND 360 OR heading IS NULL
      )
    );

    CREATE INDEX IF NOT EXISTS idx_active_tracking_manufacturer 
      ON active_tracking(manufacturer);
    CREATE INDEX IF NOT EXISTS idx_active_tracking_last_seen 
      ON active_tracking(last_seen);
    CREATE INDEX IF NOT EXISTS idx_active_tracking_coords 
      ON active_tracking(latitude, longitude);
  `;

  await db.exec(trackedAircraftTable);
  await db.exec(activeTrackingTable);
}

export { DatabaseConnection, initializeTables };
export default DatabaseConnection;
