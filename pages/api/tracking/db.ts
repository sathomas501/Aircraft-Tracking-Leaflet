import path from 'path';

// ✅ Ensure sqlite3 is only loaded on the server
let sqlite3: typeof import('sqlite3');
if (typeof window === 'undefined') {
  sqlite3 = require('sqlite3');
}

// ✅ Explicitly define the Database type
type SQLiteDatabase = import('sqlite3').Database;

class DatabaseConnection {
  private static instance: SQLiteDatabase | null = null;
  private static DB_PATH = path.join(process.cwd(), 'lib', 'db', 'tracking.db');

  // ✅ Safe database initialization
  static async getInstance(): Promise<SQLiteDatabase> {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = await new Promise<SQLiteDatabase>(
        (resolve, reject) => {
          try {
            const db = new sqlite3.Database(
              DatabaseConnection.DB_PATH,
              (err) => {
                if (err) {
                  console.error('[Database] ❌ Failed to connect:', err);
                  reject(err);
                } else {
                  console.log('[Database] ✅ Connected successfully');
                  resolve(db);
                }
              }
            );
          } catch (error) {
            console.error('[Database] ❌ Unexpected error:', error);
            reject(error);
          }
        }
      );
    }

    if (!DatabaseConnection.instance) {
      throw new Error('Failed to initialize database connection');
    }

    return DatabaseConnection.instance;
  }

  // ✅ Safe query execution with error handling
  static async executeQuery<T = any>(
    sql: string,
    params: any[] = []
  ): Promise<T[]> {
    const db = await DatabaseConnection.getInstance();
    return new Promise<T[]>((resolve, reject) => {
      db.all(sql, params, (err, rows: T[]) => {
        if (err) {
          console.error('[Database] ❌ Query failed:', sql, err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
}

// ✅ Utility function for table initialization
async function initializeTables(): Promise<void> {
  const db = await DatabaseConnection.getInstance();

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
    CREATE TABLE IF NOT EXISTS tracked_aircraft (
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
      last_contact INTEGER,
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

    CREATE INDEX IF NOT EXISTS idx_aircraft_tracked_manufacturer 
      ON aircraft_tracked(manufacturer);
    CREATE INDEX IF NOT EXISTS idx_aircraft_tracked_last_contact 
      ON aircraft_tracked(last_contact);
    CREATE INDEX IF NOT EXISTS idx_aircraft_tracked_coords 
      ON aircraft_tracked(latitude, longitude);
  `;

  try {
    await db.exec(trackedAircraftTable);
    await db.exec(activeTrackingTable);
    console.log('[Database] ✅ Tables initialized successfully');
  } catch (error) {
    console.error('[Database] ❌ Error initializing tables:', error);
    throw error;
  }
}

export { DatabaseConnection, initializeTables };
export default DatabaseConnection;
