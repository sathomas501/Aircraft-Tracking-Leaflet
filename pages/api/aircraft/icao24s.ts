// pages/api/aircraft/icao24s.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase } from '@/lib/db/databaseManager';

const db = await getDatabase();

interface Icao24Response {
    icao24List: string[];
    message?: string;
    error?: string;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        const db = await getDatabase();
        const { manufacturer, model } = req.query;

        if (!manufacturer) {
            return res.status(400).json({ error: 'Manufacturer parameter required' });
        }

        let query = `
            SELECT DISTINCT icao24
            FROM aircraft
            WHERE manufacturer = ?
            AND icao24 IS NOT NULL
            AND icao24 != ''
        `;
        
        let params = [manufacturer];

        // Add model filter if provided
        if (model) {
            query += ` AND model = ?`;
            params.push(model as string);
        }

        query += ' LIMIT 500';  // Reasonable limit for tracking
        const aircraft = await db.all(query, params);

        res.status(200).json({
            icao24List: aircraft.map(a => a.icao24),
            meta: {
                total: aircraft.length,
                manufacturer,
                model: model || 'all',
                timestamp: new Date().toISOString()
            }
        });

        console.log('Fetching ICAO24s with query:', {
            manufacturer,
            model: model || 'all',
            sqlQuery: query,
            params
        });
        
        if (aircraft.length === 0) {
            console.warn('No ICAO24s found for the given parameters');
        } else {
            console.log(`Fetched ${aircraft.length} ICAO24s, sample:`, aircraft.slice(0, 5));
        }
        

    } catch (error) {
        console.error('Database query error:', error);
        res.status(500).json({
            error: 'Failed to fetch ICAO24 list',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}