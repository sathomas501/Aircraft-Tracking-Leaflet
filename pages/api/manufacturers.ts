import { NextApiRequest, NextApiResponse } from 'next';
import { DatabaseManager } from '@/lib/db/databaseManager';

interface ManufacturerData {
   name: string;
   count: number;
   activeCount?: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // GET Method: Fetch Top Manufacturers
    if (req.method === 'GET') {
        try {
            const staticDb = DatabaseManager.getInstance();
            await staticDb.initialize();

            // Query to get manufacturers and counts
            const result = await staticDb.allQuery<ManufacturerData>(`
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

            console.log('[Debug] GET Query result:', result);
            return res.status(200).json({ manufacturers: result });
        } catch (error) {
            console.error('[Error] Database error on GET:', error);
            return res.status(500).json({ error: 'Failed to fetch manufacturers. Please try again later.' });
        }
    }

    // POST Method: Fetch Aircraft by Manufacturer
    if (req.method === 'POST') {
        const { manufacturer } = req.body;

        if (!manufacturer) {
            return res.status(400).json({ error: 'Manufacturer is required.' });
        }

        try {
            const staticDb = DatabaseManager.getInstance();
            await staticDb.initialize();

            // Query to fetch aircraft for the given manufacturer
            const result = await staticDb.allQuery(`
                SELECT * 
                FROM aircraft 
                WHERE manufacturer = ? 
                ORDER BY model;
            `, [manufacturer]);

            console.log('[Debug] POST Query result:', result);
            return res.status(200).json({ positions: result });
        } catch (error) {
            console.error('[Error] Database error on POST:', error);
            return res.status(500).json({ error: 'Failed to fetch aircraft for the selected manufacturer.' });
        }
    }

    // Method Not Allowed
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
}
