import path from 'path';
import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import fs from 'fs';

// Define possible database paths
const possiblePaths = [
  path.join(process.cwd(), 'lib', 'db', 'aircraft.db'),
  path.join(process.cwd(), 'aircraft.db'),
  path.resolve('./lib/db/aircraft.db'),
];

export async function getDb() {
    if (db) {
        return db;
    }

    // Enhanced debug info
    console.log('Database connection attempt:', new Date().toISOString());
    console.log('Current working directory:', process.cwd());
    console.log('Node environment:', process.env.NODE_ENV);

    // Check all possible paths
    console.log('Checking possible database locations:');
    possiblePaths.forEach(dbPath => {
        try {
            const exists = fs.existsSync(dbPath);
            const stats = exists ? fs.statSync(dbPath) : null;
            console.log({
                path: dbPath,
                exists,
                size: stats ? `${stats.size} bytes` : 'N/A',
                permissions: stats ? (stats.mode & parseInt('777', 8)).toString(8) : 'N/A'
            });
        } catch (error) {
            console.error(`Error checking path ${dbPath}:`, error);
        }
    });

    // Try to find the first valid database path
    const dbPath = possiblePaths.find(p => fs.existsSync(p));
    
    if (!dbPath) {
        throw new Error(`Database file not found in any of the expected locations: ${possiblePaths.join(', ')}`);
    }

    try {
        console.log('Attempting to open database at:', dbPath);
        
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database,
            mode: sqlite3.OPEN_READONLY
        });

        // Verify connection by running a simple query
        const testResult = await db.get('SELECT COUNT(*) as count FROM sqlite_master');
        console.log('Database connection test result:', testResult);

        return db;
    } catch (error) {
        console.error('Database connection error:', error);
        throw error;
    }
}

let db: Database | null = null;

// Clean up connection on server shutdown
process.on('SIGTERM', async () => {
    if (db) {
        await db.close();
        db = null;
    }
});