// pages/api/aircraft/track-manufacturer.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { DatabaseManager } from '@/lib/db/databaseManager';
import { TrackingDatabaseManager } from '@/lib/db/trackingDatabaseManager';
import { handleApiError } from "@/lib/services/error-handler";
import { fetchLiveData } from '@/lib/services/fetch-Live-Data';
import UnifiedCacheService from '@/lib/services/managers/unified-cache-system';
import { Aircraft, transformToAircraft, transformToCachedData } from "@/types/base";

interface LiveDataResponse {
    icao24s: string[];
    liveAircraft: Aircraft[];
    message?: string;
    warning?: string;
}

interface IcaoQueryResult {
    icao24: string;
}

// Singleton instances
const dbManager = DatabaseManager.getInstance();
const trackingDb = TrackingDatabaseManager.getInstance();
const cacheService = UnifiedCacheService.getInstance();

// ✅ Check Cache First
const getCachedData = (manufacturer: string) => {
    const cachedData = cacheService.getLiveData(manufacturer);
    if (cachedData?.length) {
        console.log(`[Cache] Found cached data for: ${manufacturer}`);
        return {
            icao24s: cachedData.map(data => data.icao24),
            liveAircraft: cachedData.map(transformToAircraft),
            message: 'Data served from cache',
        };
    }
    return null;
};

// ✅ Fetch ICAO24s from Database
const getIcao24s = async (manufacturer: string, model?: string): Promise<IcaoQueryResult[]> => {
    const query = `
        SELECT DISTINCT icao24
        FROM aircraft
        WHERE manufacturer = ?
        ${model ? "AND model = ?" : ""}
        AND icao24 IS NOT NULL AND icao24 != ''
        LIMIT 2000;
    `;
    const params = model ? [manufacturer, model] : [manufacturer];
    return await dbManager.executeQuery<IcaoQueryResult>(query, params);
};


// ✅ Merge Static & Live Data
const mergeStaticAndLiveData = (liveData: Aircraft[], staticData: Aircraft[]): Aircraft[] => {
    const staticDataMap: Map<string, Aircraft> = new Map(
        staticData.map(aircraft => [aircraft.icao24, aircraft])
    );

    return liveData.map(live => {
        const staticInfo: Aircraft | undefined = staticDataMap.get(live.icao24);

        return {
            ...live,
            ["N-NUMBER"]: staticInfo?.["N-NUMBER"] || "",      // ✅ Use bracket notation
            manufacturer: staticInfo?.manufacturer || "",
            model: staticInfo?.model || "",
            NAME: staticInfo?.NAME || "",
            CITY: staticInfo?.CITY || "",
            STATE: staticInfo?.STATE || "",
            TYPE_AIRCRAFT: staticInfo?.TYPE_AIRCRAFT || "",
            OWNER_TYPE: staticInfo?.OWNER_TYPE || "",
            isTracked: true,
        };
    });
};


// ✅ Upsert Live Data to Tracking DB
const upsertLiveData = async (aircraft: Aircraft[]) => {
    const trackingData = aircraft.map(a => ({
        icao24: a.icao24,
        latitude: a.latitude,
        longitude: a.longitude,
        altitude: a.altitude,
        velocity: a.velocity,
        heading: a.heading,
        on_ground: a.on_ground,
        last_contact: a.last_contact,
        updated_at: Date.now(),
    }));

    await trackingDb.upsertActiveAircraftBatch(trackingData);
    console.log(`[API] Upserted ${trackingData.length} aircraft positions`);
};

// ✅ API Handler
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<LiveDataResponse | { error: string }>
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { manufacturer, model } = req.body;

        if (!manufacturer || typeof manufacturer !== "string") {
            return res.status(400).json({ error: "Manufacturer is required" });
        }

        console.log(`[API] Tracking: ${manufacturer}, Model: ${model || "Any"}`);

        // Check Cache
        const cachedResponse = getCachedData(manufacturer);
        if (cachedResponse) return res.status(200).json(cachedResponse);

        // Initialize Database
        await dbManager.initializeDatabase();

        // Fetch ICAO24s
        const icao24Results = await getIcao24s(manufacturer, model);
        if (!icao24Results.length) {
            return res.status(404).json({ error: `No ICAO24s found for ${manufacturer}${model ? ` and model ${model}` : ""}` });
        }

        const icao24s = icao24Results.map(r => r.icao24);
        console.log(`[API] Retrieved ${icao24s.length} ICAO24s`);

        // Fetch Live Data
        const liveAircraft = await fetchLiveData(icao24s);
        if (!liveAircraft.length) {
            return res.status(404).json({ error: "No live aircraft data found" });
        }

        // Fetch Static Data
        const staticData = await dbManager.executeQuery<Aircraft>(
            `SELECT icao24, "N-NUMBER", manufacturer, model, NAME, CITY, STATE, TYPE_AIRCRAFT, OWNER_TYPE
             FROM aircraft
             WHERE icao24 IN (${icao24s.map(() => '?').join(',')})`,
            icao24s
        );

        // Merge, Cache, and Upsert Data
        const mergedData = mergeStaticAndLiveData(liveAircraft, staticData);
        cacheService.setLiveData(manufacturer, mergedData.map(transformToCachedData));
        await upsertLiveData(liveAircraft);

        return res.status(200).json({
            icao24s,
            liveAircraft: mergedData,
            message: `Tracking ${mergedData.length} active aircraft`,
        });

    } catch (error) {
        console.error(`[API] Error:`, error);
        return handleApiError(res, error);
    }
}
