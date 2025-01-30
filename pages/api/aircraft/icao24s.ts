// pages/api/aircraft/icao24s.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import databaseManager from '@/lib/db/databaseManager'; // ✅ Fix import

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
            : req.query.manufacturer as string; // ✅ Ensure it's a string

        console.log('Extracted manufacturer:', manufacturer);

        if (!manufacturer) {
            console.log('No manufacturer provided');
            return res.status(400).json({ 
                icao24List: [],
                error: 'Manufacturer parameter required',
                message: 'Request body or query must include manufacturer'
            });
        }

        // ✅ Fix: Use DatabaseManager instance instead of `getDatabase`
     // Removed unnecessary initialization

        const db = databaseManager;

        let query = `
            SELECT DISTINCT icao24
            FROM aircraft
            WHERE manufacturer = ?
            AND icao24 IS NOT NULL
            AND icao24 != ''
            LIMIT 500
        `;

        console.log('Executing query:', { query, params: [manufacturer] });

        const results: { icao24: string }[] = await db.executeQuery(query, [manufacturer]);

// ✅ Use proper type annotation to avoid nested array interpretation
const icao24List = results.map(item => item.icao24);

return res.status(200).json({
    icao24List,
    meta: {
        total: results.length,
        manufacturer: manufacturer,
        timestamp: new Date().toISOString()
    }
});

    } catch (error) {
        console.error('[API] Database error:', error);
        return res.status(500).json({ 
            icao24List: [], 
            error: 'Internal server error', 
            message: error instanceof Error ? error.message : 'Unknown error' 
        });
    }
}
