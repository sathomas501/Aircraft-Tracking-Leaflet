// pages/api/aircraft/icao24s.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase } from '@/lib/db/databaseManager';

interface Icao24Response {
    icao24List: string[];
    meta?: {
        total: number;
        manufacturer: string;
        model?: string;
        timestamp: string;
    };
    error?: string;
    message?: string;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<Icao24Response>
) {
    console.log('ICAO24s endpoint called with:', {
        method: req.method,
        body: req.body,
        query: req.query
    });

    try {
        // For POST request, get manufacturer from body
        const manufacturer = req.method === 'POST' 
            ? req.body.manufacturer 
            : req.query.manufacturer;

        console.log('Extracted manufacturer:', manufacturer);

        if (!manufacturer) {
            console.log('No manufacturer provided');
            return res.status(400).json({ 
                icao24List: [],
                error: 'Manufacturer parameter required',
                message: 'Request body or query must include manufacturer'
            });
        }

        const db = await getDatabase();
        
        let query = `
            SELECT DISTINCT icao24
            FROM aircraft
            WHERE manufacturer = ?
            AND icao24 IS NOT NULL
            AND icao24 != ''
        `;
        
        let params = [manufacturer];

        // Add model filter if provided
        const model = req.method === 'POST' ? req.body.model : req.query.model;
        if (model) {
            query += ` AND model = ?`;
            params.push(model);
        }

        query += ' LIMIT 500';

        console.log('Executing query:', {
            query,
            params
        });


        const result = await db.all(query, params);
        
        // Transform result objects into array of strings
        const icao24List = result.map(item => item.icao24);

        console.log('ICAO24s fetched:', {
            count: icao24List.length,
            sample: icao24List.slice(0, 5),
            format: typeof icao24List[0]
        });

        return res.status(200).json({
            icao24List,
            meta: {
                total: icao24List.length,
                manufacturer,
                model: model || undefined,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Database query error:', error);
        return res.status(500).json({
            icao24List: [],
            error: 'Failed to fetch ICAO24 list',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}