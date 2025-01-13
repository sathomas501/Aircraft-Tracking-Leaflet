// lib/db/activeConnection.ts
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';

let db: Database | null = null;

export async function getActiveDb() {
    if (!db) {
        // Ensure data directory exists
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        const dbPath = path.join(dataDir, 'active_status.db');
        console.log('Opening active status database at:', dbPath);

        // Open or create the database
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        // Initialize schema if needed
        await db.exec(`
            CREATE TABLE IF NOT EXISTS active_aircraft (
                icao24 TEXT PRIMARY KEY,
                manufacturer TEXT NOT NULL,
                model TEXT,
                last_contact INTEGER NOT NULL,
                latitude REAL,
                longitude REAL,
                altitude REAL,
                velocity REAL,
                heading REAL,
                on_ground BOOLEAN DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(icao24)
            );

            CREATE INDEX IF NOT EXISTS idx_active_manufacturer 
            ON active_aircraft(manufacturer);

            CREATE INDEX IF NOT EXISTS idx_active_last_contact 
            ON active_aircraft(last_contact);
        `);

        // Set up automatic cleanup trigger
        await db.exec(`
            CREATE TRIGGER IF NOT EXISTS cleanup_old_aircraft
            AFTER INSERT ON active_aircraft
            BEGIN
                DELETE FROM active_aircraft 
                WHERE last_contact < unixepoch('now') - 7200;
            END;
        `);

        console.log('Active status database initialized successfully');
    }

    return db;
}

export async function closeActiveDb() {
    if (db) {
        await db.close();
        db = null;
    }
}

export async function clearStaleData(): Promise<number> {
    const db = await getActiveDb();
    const result = await db.run(`
        DELETE FROM active_aircraft 
        WHERE last_contact < unixepoch('now') - 7200
    `);
    return result.changes || 0;
}