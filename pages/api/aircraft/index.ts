import { NextApiRequest, NextApiResponse } from 'next';
import sqlite3 from 'sqlite3';
import path from 'path';

// Define database path
const dbPath = path.join(process.cwd(), 'lib', 'aircraft.db');

// Database service functions
async function fetchManufacturers(activeOnly: boolean = false): Promise<string[]> {
    const query = activeOnly
        ? `SELECT DISTINCT manufacturer FROM aircraft WHERE active = 1 AND manufacturer IS NOT NULL ORDER BY manufacturer`
        : `SELECT DISTINCT manufacturer FROM aircraft WHERE manufacturer IS NOT NULL ORDER BY manufacturer`;

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

    return new Promise((resolve, reject) => {
        db.all(query, [], (err, rows: { manufacturer: string }[]) => {
            db.close();
            if (err) return reject(err);
            resolve(rows.map(row => row.manufacturer));
        });
    });
}

// API route handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ 
            error: 'Method not allowed', 
            message: `HTTP method ${req.method} is not supported.` 
        });
    }

    const { activeOnly } = req.query;

    try {
        const manufacturers = await fetchManufacturers(activeOnly === 'true');
        res.status(200).json({ manufacturers });
    } catch (error) {
        console.error('Error in API handler:', error);
        res.status(500).json({ 
            message: 'Failed to fetch manufacturers',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
}