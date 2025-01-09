// pages/api/aircraft/icao24s.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/db/connection';

interface Icao24Response {
    icao24List: string[];
    message?: string;
    error?: string;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<Icao24Response>
) {
    if (req.method !== 'GET') {
        return res.status(405).json({
            icao24List: [],
            error: 'Method not allowed'
        });
    }

    const { manufacturer } = req.query;
    console.log('Received manufacturer query:', manufacturer);

    if (!manufacturer || typeof manufacturer !== 'string') {
        return res.status(400).json({
            icao24List: [],
            error: 'Manufacturer parameter is required and must be a string'
        });
    }

    try {
        const db = await getDb();
        const query = `
            SELECT icao24
            FROM aircraft
            WHERE manufacturer = ?
                AND icao24 IS NOT NULL
                AND LENGTH(TRIM(icao24)) > 0;
        `;
        
        const results = await db.all(query, [manufacturer]);
        const icao24List = results.map(row => row.icao24);

        if (!icao24List.length) {
            return res.status(200).json({
                icao24List: [],
                message: `No ICAO24 numbers found for manufacturer: ${manufacturer}`
            });
        }

        return res.status(200).json({ icao24List });
    } catch (error) {
        console.error('Error fetching ICAO24 numbers:', error);
        return res.status(500).json({
            icao24List: [],
            error: 'Internal server error while fetching ICAO24 numbers'
        });
    }
}