import path from 'path';
import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import fs from 'fs';

export const dbPath = path.join(process.cwd(), 'lib', 'db', 'aircraft.db');

let db: Database | null = null;

export async function getDb() {
    if (db) {
        return db;
    }

    // Debug info for development
    if (process.env.NODE_ENV === 'development') {
        console.log('Current working directory:', process.cwd());
        console.log('Attempting to open database at:', dbPath);
        console.log('Database file exists:', fs.existsSync(dbPath));
        console.log('Directory contents:', fs.readdirSync(path.join(process.cwd(), 'lib', 'db')));
    }

    db = await open({
        filename: dbPath,
        driver: sqlite3.Database,
        mode: sqlite3.OPEN_READONLY
    });

    return db;
}

// Clean up connection on server shutdown
process.on('SIGTERM', async () => {
    if (db) {
        await db.close();
        db = null;
    }
});