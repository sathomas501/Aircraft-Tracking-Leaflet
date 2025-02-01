// pages/api/aircraft/static-data.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { DatabaseManager } from '@/lib/db/databaseManager';
import { handleApiError } from "@/lib/services/error-handler";
import { Aircraft } from "@/types/base";

const dbManager = DatabaseManager.getInstance();

export default async function handler(
    req: NextApiRequest, 
    res: NextApiResponse<Aircraft[] | { error: string }>
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { icao24s } = req.body;
        
        if (!Array.isArray(icao24s) || icao24s.length === 0) {
            return res.status(400).json({ error: "Valid ICAO24 list required" });
        }

        await dbManager.initializeDatabase();

        const staticData = await dbManager.executeQuery<Aircraft>(
            `SELECT 
                icao24,
                "N-NUMBER",
                manufacturer,
                model,
                NAME,
                CITY,
                STATE,
                TYPE_AIRCRAFT,
                OWNER_TYPE
            FROM aircraft 
            WHERE icao24 IN (${icao24s.map(() => '?').join(',')})`,
            icao24s
        );

        return res.status(200).json(staticData);

    } catch (error) {
        return handleApiError(res, error);
    }
}