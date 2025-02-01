// pages/api/aircraft/track-manufacturer.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { DatabaseManager } from '@/lib/db/databaseManager';
import { handleApiError } from "@/lib/services/error-handler";
import { fetchLiveData } from '@/lib/services/fetch-Live-Data';
import { Aircraft } from "@/types/base";

interface LiveDataResponse {
    icao24s: string[];
    liveAircraft: Aircraft[];
    message?: string;
    warning?: string;
}

interface IcaoQueryResult {
    icao24: string;
}

// Initialize database manager
const dbManager = DatabaseManager.getInstance();

export default async function handler(req: NextApiRequest, res: NextApiResponse<LiveDataResponse | { error: string }>) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { manufacturer, model } = req.body;
        if (!manufacturer || typeof manufacturer !== "string") {
            return res.status(400).json({ error: "Manufacturer is required" });
        }

        console.log(`[API] Tracking manufacturer: ${manufacturer}, Model: ${model || "Any"}`);

        // Ensure database is initialized
        await dbManager.initializeDatabase();

        // Execute query with proper typing
        const queryResult: IcaoQueryResult[] = await dbManager.executeQuery<IcaoQueryResult>(
            `SELECT DISTINCT icao24 
            FROM aircraft
            WHERE manufacturer = ?
              ${model ? "AND model = ?" : ""}
              AND icao24 IS NOT NULL
              AND icao24 != ''
            LIMIT 2000;`,
            model ? [manufacturer, model] : [manufacturer]
        );

        if (!queryResult || queryResult.length === 0) {
            return res.status(404).json({ error: "No ICAO24s found for this manufacturer" });
        }

        // Extract ICAO24 strings
        const icao24s = queryResult.map(r => r.icao24);
        console.log(`[API] Retrieved ${icao24s.length} ICAO24s for ${manufacturer}`);

        // Fetch live positions from OpenSky
        try {
            const liveAircraft: Aircraft[] = await fetchLiveData(icao24s);
            const aircraftCount = liveAircraft?.length || 0;
            console.log(`[API] Retrieved live data for ${aircraftCount} aircraft`);

            return res.status(200).json({ 
                icao24s: icao24s,
                liveAircraft: liveAircraft, 
                message: "Live data fetch successful"
            });

        } catch (error) {
            console.error("[API] Error fetching live data:", error);
            
            return res.status(200).json({ 
                icao24s: icao24s,
                liveAircraft: [], 
                warning: "Failed to fetch live positions"
            });
        }

    } catch (error) {
        return handleApiError(res, error);
    }
}

