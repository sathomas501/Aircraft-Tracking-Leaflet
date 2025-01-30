// pages/api/manufacturers/list.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { DatabaseManager } from '@/lib/db/databaseManager';

async function fetchManufacturers() {
    const staticDb = DatabaseManager.getInstance();
        await staticDb.initializeDatabase();  // ✅ Correct method

    // Query to get manufacturers with their counts
    const result = await staticDb.executeQuery(`
        SELECT 
            manufacturer AS name, 
            COUNT(*) AS count 
        FROM aircraft 
        WHERE manufacturer IS NOT NULL 
          AND TRIM(manufacturer) != ''
        GROUP BY manufacturer 
        ORDER BY count DESC 
        LIMIT 50;
    `);

    return result;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const manufacturers = await fetchManufacturers();
        return res.status(200).json({ manufacturers });
    } catch (error) {
        console.error('[Error] Failed to fetch manufacturers:', error);
        return res.status(500).json({ 
            error: 'Failed to fetch manufacturers',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}