import { NextApiRequest, NextApiResponse } from 'next';
import { DatabaseManager } from '@/lib/db/databaseManager';
import type { SelectOption } from '@/types/base';

// Response types for GET and POST
interface ManufacturersGetResponse {
    manufacturers: SelectOption[];
    error?: string;
    message?: string;
}

interface ManufacturersPostResponse {
    positions: any[]; // Replace 'any' with your aircraft position type
    error?: string;
    message?: string;
}
const requestCache = new Set<string>();  // ✅ Prevents duplicate requests
type ManufacturersResponse = ManufacturersGetResponse | ManufacturersPostResponse;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Expires', '0');
    res.setHeader('Pragma', 'no-cache');

    // GET Method: Fetch Top Manufacturers
    if (req.method === 'GET') {
        try {
            const staticDb = DatabaseManager.getInstance();
          

            const result = await staticDb.executeQuery<{ name: string; count: number; }>(`
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

            const manufacturers: SelectOption[] = result.map(m => ({
                value: m.name,
                label: m.name,
                count: m.count
            }));

            console.log('[Debug] GET Query result:', manufacturers.slice(0, 3));
            return res.status(200).json({ manufacturers });
        } catch (error) {
            console.error('[Error] Database error on GET:', error);
            return res.status(500).json({ 
                manufacturers: [],
                error: 'Failed to fetch manufacturers. Please try again later.'
            });
        }
    }

    // POST Method: Fetch Aircraft by Manufacturer
    if (req.method === 'POST') {
        const { manufacturer } = req.body;

        if (!manufacturer) {
            return res.status(400).json({ 
                positions: [],
                error: 'Manufacturer is required.'
            });
        }

        try {
            const staticDb = DatabaseManager.getInstance();
          

            const result = await staticDb.executeQuery(`
                SELECT * 
                FROM aircraft 
                WHERE manufacturer = ? 
                ORDER BY model;
            `, [manufacturer]);

            console.log('[Debug] POST Query result:', result);
            return res.status(200).json({ positions: result });
        } catch (error) {
            console.error('[Error] Database error on POST:', error);
            return res.status(500).json({ 
                positions: [],
                error: 'Failed to fetch aircraft for the selected manufacturer.'
            });
        }
    }
}
