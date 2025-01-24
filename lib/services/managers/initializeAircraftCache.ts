import { unifiedCache } from './unified-cache-system';
import { allQuery } from '../../db/databaseManager';
import type { OpenSkyAircraft } from '@/types/opensky';

export async function initializeAircraftCache() {
    if (typeof window !== 'undefined') return;

    // Temporary interface to describe the database rows
    interface AircraftRow {
        icao24: string;
        latitude: number | null;
        longitude: number | null;
        altitude: number | null;
        velocity: number | null;
        heading: number | null;
        on_ground: boolean | null;
        last_contact: number | null;
        manufacturer?: string; // Optional field in case it's missing from the database
    }

    const aircraft: AircraftRow[] = (await allQuery('SELECT * FROM aircraft_data', [])) as AircraftRow[];

    // Map and transform the database rows into OpenSkyAircraft
    const typedAircraft: OpenSkyAircraft[] = aircraft.map((item) => ({
        icao24: item.icao24,
        latitude: item.latitude ?? 0, // Default to 0 if null
        longitude: item.longitude ?? 0,
        altitude: item.altitude ?? 0,
        velocity: item.velocity ?? 0,
        heading: item.heading ?? 0,
        on_ground: item.on_ground ?? false,
        last_contact: item.last_contact ?? Math.floor(Date.now() / 1000),
        manufacturer: item.manufacturer || 'Unknown', // Default if manufacturer is missing
    }));

    const dbData = { aircraft: typedAircraft };

    await unifiedCache.setLatestData(dbData);

    // Verify cache
    const cached = await unifiedCache.getLatestData();
    console.log('[Cache] Verification:', {
        original: dbData.aircraft.length,
        cached: cached.aircraft.length,
    });

    return dbData;
}
