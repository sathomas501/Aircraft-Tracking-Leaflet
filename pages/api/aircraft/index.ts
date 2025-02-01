import { NextApiRequest, NextApiResponse } from 'next';
import databaseManager from '@/lib/db/databaseManager';

export const config = {
    runtime: 'nodejs', // Ensure Node.js runtime
};

interface ManufacturerRow {
    manufacturer: string;
}

// Database service functions
async function fetchManufacturers(activeOnly: boolean = false): Promise<string[]> {
    const query = activeOnly
        ? `SELECT DISTINCT manufacturer 
           FROM aircraft 
           WHERE active = 1 
           AND manufacturer IS NOT NULL 
           ORDER BY manufacturer`
        : `SELECT DISTINCT manufacturer 
           FROM aircraft 
           WHERE manufacturer IS NOT NULL 
           ORDER BY manufacturer`;

    try {
        const rows = await databaseManager.allQuery<ManufacturerRow>(query);
        return rows.map((row: ManufacturerRow) => row.manufacturer);
    } catch (error) {
        console.error('[Database] Failed to fetch manufacturers:', error);
        throw error;
    }
}

// API route handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        const { activeOnly } = req.query;
        try {
            const manufacturers = await fetchManufacturers(activeOnly === 'true');
            res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
            return res.status(200).json({ manufacturers });
        } catch (error) {
            console.error('[API] Error in handler:', error);
            return res.status(500).json({
                message: 'Failed to fetch manufacturers',
                error: process.env.NODE_ENV === 'development' 
                    ? error instanceof Error ? error.message : 'Unknown error' 
                    : undefined
            });
        }
    } else if (req.method === 'POST') {
        const { manufacturer } = req.body;
        if (!manufacturer) {
            return res.status(400).json({ error: 'Manufacturer parameter required' });
        }
        // Add your POST logic here
        return res.status(200).json({ 
            success: true, 
            message: `Manufacturer '${manufacturer}' processed successfully` 
        });
    }

    return res.status(405).json({
        error: 'Method not allowed',
        message: `HTTP method ${req.method} is not supported.`
    });
}