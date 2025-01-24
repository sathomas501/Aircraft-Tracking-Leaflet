import type { NextApiRequest, NextApiResponse } from 'next';
import { unifiedCache } from '../../lib/services/managers/unified-cache-system';


interface ManufacturersResponse {
  manufacturers?: { value: string; label: string }[];
  error?: string;
}

// manufacturers.ts
interface Aircraft {
    manufacturer: string;
 }
 
 export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        // Attempt to fetch data from cache
        const data = await unifiedCache.getLatestData();

        // Ensure data is valid
        if (!data || !Array.isArray(data.aircraft)) {
            throw new Error('Cache is empty or invalid.');
        }

        // Extract manufacturers
        const manufacturers = Array.from(new Set(
            data.aircraft.map((aircraft: any) => aircraft.manufacturer)
        ))
            .filter(Boolean)
            .map((m) => ({ value: m, label: m }));

        // Send response
        res.status(200).json({ manufacturers });
    } catch (error) {
        if (error instanceof Error) {
            console.error('[ERROR] API Handler Failed:', error.message);
            res.status(500).json({ error: error.message });
        } else {
            console.error('[ERROR] API Handler Failed with unknown error:', error);
            res.status(500).json({ error: 'An unknown error occurred.' });
        }
    }
}
