import { NextApiRequest, NextApiResponse } from 'next';
import { DatabaseManager } from '@/lib/db/databaseManager';
import type { SelectOption } from '@/types/base';

// Separate response types for GET and POST
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

type ManufacturersResponse = ManufacturersGetResponse | ManufacturersPostResponse;

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ManufacturersResponse>
) {
    // GET Method: Fetch Top Manufacturers
    if (req.method === 'GET') {
        try {
            const staticDb = DatabaseManager.getInstance();
            await staticDb.initialize();

            const result = await staticDb.allQuery<{ name: string; count: number; }>(`
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
                count: m.count,
            }));

            console.log('[Debug] GET Query result:', manufacturers.slice(0, 3));
            return res.status(200).json({
                manufacturers,
                message: 'Manufacturers fetched successfully!',
            });
        } catch (error) {
            console.error('[Error] Database error on GET:', error);
            return res.status(500).json({
                manufacturers: [],
                error: 'Failed to fetch manufacturers. Please try again later.',
            });
        }
    }

    // POST Method: Fetch Aircraft by Manufacturer
    if (req.method === 'POST') {
        const { manufacturer } = req.body;

        if (!manufacturer) {
            return res.status(400).json({
                positions: [],
                error: 'Manufacturer is required to fetch aircraft data.',
            });
        }

        try {
            const staticDb = DatabaseManager.getInstance();
            await staticDb.initialize();

            const result = await staticDb.allQuery(`
                SELECT * 
                FROM aircraft 
                WHERE manufacturer = ? 
                ORDER BY model;
            `, [manufacturer]);

            
            console.log('[Debug] POST Query result:', result);
            return res.status(200).json({
                positions: result,
                message: `Aircraft data for '${manufacturer}' fetched successfully!`,
            });
        } catch (error) {
            console.error('[Error] Database error on POST:', error);
            return res.status(500).json({
                positions: [],
                error: 'Failed to fetch aircraft for the selected manufacturer.',
            });
        }
    }

    // Method Not Allowed
    return res.status(405).json({
        manufacturers: [],
        error: `Method ${req.method} not allowed.`,
    } as ManufacturersGetResponse);
}
