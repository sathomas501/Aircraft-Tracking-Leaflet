import { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase } from '@/lib/db/databaseManager';

export const config = {
    runtime: 'nodejs', // Ensure Node.js runtime
};

// Database service functions
async function fetchManufacturers(activeOnly: boolean = false): Promise<string[]> {
    const query = activeOnly
        ? `SELECT DISTINCT manufacturer FROM aircraft WHERE active = 1 AND manufacturer IS NOT NULL ORDER BY manufacturer`
        : `SELECT DISTINCT manufacturer FROM aircraft WHERE manufacturer IS NOT NULL ORDER BY manufacturer`;

    try {
        const db = await getDatabase();
        const rows: { manufacturer: string }[] = await db.all(query);
        return rows.map(row => row.manufacturer);
    } catch (error) {
        console.error('[Database] Failed to fetch manufacturers:', error);
        throw error;
    }
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
        return res.status(200).json({ manufacturers });
    } catch (error) {
        console.error('[API] Error in handler:', error);
        return res.status(500).json({ 
            message: 'Failed to fetch manufacturers',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
}
