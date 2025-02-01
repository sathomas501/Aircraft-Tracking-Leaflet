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

        // Get ICAO24s from static database
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

        const icao24s = queryResult.map(r => r.icao24);
        console.log(`[API] Retrieved ${icao24s.length} ICAO24s for ${manufacturer}`);

        try {
            // Get live position data
            const liveAircraft = await fetchLiveData(icao24s);
            
            if (liveAircraft && liveAircraft.length > 0) {
                // Get static data for these aircraft
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

                // Create a map of static data
                const staticDataMap = new Map(
                    staticData.map(aircraft => [aircraft.icao24, aircraft])
                );

                // Combine live and static data
                const enrichedAircraft = liveAircraft.map(liveAc => {
                    const staticAc = staticDataMap.get(liveAc.icao24);
                    return {
                        ...liveAc,
                        "N-NUMBER": staticAc?.["N-NUMBER"] || "",
                        manufacturer: staticAc?.manufacturer || manufacturer,
                        model: staticAc?.model || "Unknown",
                        NAME: staticAc?.NAME || "",
                        CITY: staticAc?.CITY || "",
                        STATE: staticAc?.STATE || "",
                        TYPE_AIRCRAFT: staticAc?.TYPE_AIRCRAFT || "3", // Default to jet for Learjet
                        OWNER_TYPE: staticAc?.OWNER_TYPE || "2"  // Default to corporate
                    };
                });

                console.log(`[API] Enriched ${enrichedAircraft.length} aircraft with static data`);

                return res.status(200).json({ 
                    icao24s,
                    liveAircraft: enrichedAircraft,
                    message: "Live data fetch successful"
                });
            }

            return res.status(200).json({ 
                icao24s,
                liveAircraft: [],
                message: "No live aircraft found"
            });

        } catch (error) {
            console.error("[API] Error fetching live data:", error);
            return res.status(200).json({ 
                icao24s,
                liveAircraft: [], 
                warning: "Failed to fetch live positions"
            });
        }

    } catch (error) {
        return handleApiError(res, error);
    }
}

