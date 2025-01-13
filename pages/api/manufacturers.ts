import type { NextApiRequest, NextApiResponse } from 'next';
import { db, runQuery } from '@/lib/db/connection';
import { getActiveDb } from '@/lib/db/activeConnection';
import type { ManufacturersResponse } from '@/types/api/api';


export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<{ manufacturers: ManufacturersResponse[] } | { error: string; message: string; manufacturers: ManufacturersResponse[] }>
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed', message: `HTTP method ${req.method} is not supported.`, manufacturers: [] });
    }

    try {
        const mainDb = db();

        const baseQuery = `
            SELECT 
                manufacturer AS value,
                manufacturer AS label,
                COUNT(*) AS count
            FROM aircraft
            WHERE 
                manufacturer IS NOT NULL 
                AND manufacturer != ''
                AND LENGTH(TRIM(manufacturer)) >= 2
                AND icao24 IS NOT NULL
                AND LENGTH(TRIM(icao24)) > 0
            GROUP BY manufacturer
            HAVING COUNT(*) >= 10
            ORDER BY COUNT(*) DESC
            LIMIT 50;
        `;

        const manufacturers = await runQuery(mainDb, baseQuery);

        if (!manufacturers || manufacturers.length === 0) {
            return res.status(200).json({ manufacturers: [] });
        }

        try {
            const activeDb = await getActiveDb();
            const placeholders = manufacturers.map(() => '?').join(',');
            const activeQuery = `
                SELECT 
                    manufacturer,
                    COUNT(DISTINCT icao24) as active_count
                FROM active_aircraft 
                WHERE 
                    manufacturer IN (${placeholders})
                    AND last_contact >= unixepoch('now') - 7200
                GROUP BY manufacturer;
            `;

            const activeResults = await runQuery(activeDb, activeQuery, manufacturers.map(m => m.value));
            const activeCountMap = new Map(activeResults.map(row => [row.manufacturer, row.active_count]));

            const response = manufacturers.map(m => ({
                ...m,
                count: Number(m.count) || 0,
                activeCount: activeCountMap.get(m.value) || 0,
            }));

            response.sort((a, b) => b.activeCount - a.activeCount || b.count - a.count);

            return res.status(200).json({ manufacturers: response });
        } catch {
            return res.status(200).json({ manufacturers });
        }
    } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch manufacturers', message: (error as Error).message, manufacturers: [] });
    }
}
