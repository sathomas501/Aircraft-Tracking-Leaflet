import { NextApiRequest, NextApiResponse } from 'next';
import databaseManager from '../../../lib/db/databaseManager';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
      // Removed unnecessary initialization


        const { method, query } = req;

        if (method === 'GET') {
            const manufacturer = query.manufacturer as string;
            if (!manufacturer) {
                return res.status(400).json({ success: false, message: "Manufacturer query parameter is required." });
            }

            console.log(`[API] Fetching models for manufacturer: ${manufacturer}`);

            const sqlQuery = `
                SELECT DISTINCT model 
                FROM aircraft 
                WHERE UPPER(manufacturer) = UPPER(?) 
                ORDER BY model
            `;

            try {
                const models: { model: string }[] = await databaseManager.executeQuery(sqlQuery, [manufacturer]);

                if (!models || models.length === 0) {
                    console.warn(`[API] No models found for manufacturer: ${manufacturer}`);
                }

                console.log(`[API] Retrieved ${models.length} models for ${manufacturer}`);

                return res.status(200).json({
                    success: true,
                    message: `Found ${models.length} models for ${manufacturer}`,
                    data: models,
                });
            } catch (error) {
                console.error(`[API] Error executing models query:`, error);
                return res.status(500).json({ success: false, message: "Database query failed." });
            }
        }

        return res.status(405).json({ success: false, message: "Method not allowed" });
    } catch (error) {
        console.error("[API] Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}
