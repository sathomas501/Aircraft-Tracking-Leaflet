//pages/api/aircraft/n-number.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { DatabaseManager } from '@/lib/db/databaseManager';

interface AircraftRecord {
    n_number: string;
    manufacturer: string;
    model: string;
    [key: string]: any;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }

    try {
        const { nNumber } = req.body;
        
        if (!nNumber) {
            return res.status(400).json({ error: 'N-Number is required' });
        }

        const staticDb = DatabaseManager.getInstance();
        await staticDb.initializeDatabase();  // ✅ Correct method

        const result = await staticDb.executeQuery<AircraftRecord>(
            'SELECT * FROM aircraft WHERE n_number = ? LIMIT 1',
            [nNumber.trim()]
        );

        if (!result.length) {
            return res.status(404).json({ error: 'Aircraft not found' });
        }

        return res.status(200).json({ positions: [result[0]] });
    } catch (error) {
        console.error('[Error] N-Number search failed:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}