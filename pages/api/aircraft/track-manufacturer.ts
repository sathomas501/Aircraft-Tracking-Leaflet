import { DatabaseManager } from '@/lib/db/databaseManager';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const staticDb = DatabaseManager.getInstance();
    await staticDb.initializeDatabase(); // Ensure the database is initialized

    if (req.method === "GET") {
        return handleGet(req, res, staticDb);
    } else if (req.method === "POST") {
        return handlePost(req, res, staticDb);
    } else {
        return res.status(405).json({ error: "Method Not Allowed" });
    }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse, staticDb: DatabaseManager) {
    try {
        const { manufacturer } = req.query;
        if (!manufacturer || typeof manufacturer !== "string") {
            return res.status(400).json({ error: "Manufacturer parameter is required and must be a string" });
        }

        console.log("[API] Fetching tracking details for manufacturer:", manufacturer);

        const result = await staticDb.executeQuery<{ icao24: string }>(`
            SELECT DISTINCT icao24 
            FROM aircraft
            WHERE manufacturer = ?
              AND icao24 IS NOT NULL
              AND icao24 != ''
            LIMIT 500;
        `, [manufacturer]);

        if (result.length === 0) {
            return res.status(404).json({ error: "No tracking data found for this manufacturer" });
        }

        console.log(`[API] Retrieved ${result.length} ICAO24s for manufacturer: ${manufacturer}`);
        return res.status(200).json({ icao24s: result });

    } catch (error) {
        console.error("[API] Error fetching tracking details:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse, staticDb: DatabaseManager) {
    try {
        const { manufacturer } = req.body;
        if (!manufacturer || typeof manufacturer !== "string") {
            return res.status(400).json({ error: "Manufacturer is required" });
        }

        console.log("[API] Tracking manufacturer:", manufacturer);

        const result = await staticDb.executeQuery<{ icao24: string }>(`
            SELECT DISTINCT icao24 
            FROM aircraft
            WHERE manufacturer = ?
              AND icao24 IS NOT NULL
              AND icao24 != ''
            LIMIT 500;
        `, [manufacturer]);

        if (result.length === 0) {
            return res.status(404).json({ error: "No ICAO24s found for this manufacturer" });
        }

        console.log(`[API] Retrieved ${result.length} ICAO24s for ${manufacturer}`);
        return res.status(200).json({ icao24s: result });

    } catch (error) {
        console.error("[API] Error tracking manufacturer:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
