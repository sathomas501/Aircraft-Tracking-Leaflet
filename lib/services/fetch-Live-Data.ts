import { pollForActiveAircraft } from '../services/polling-service';
import { AircraftPositionService } from './aircraftPositionService';
import { TrackingDatabaseManager } from '../db/trackingDatabaseManager';
import  UnifiedCacheService  from '../services/managers/unified-cache-system';
import { manufacturerTracking } from './manufacturer-tracking-service';

export async function fetchLiveData(icao24List: string[]): Promise<void> {
    const dbManager = await TrackingDatabaseManager.getInstance();
    const positionService = AircraftPositionService.getInstance();

    if (icao24List.length === 0) {
        console.warn('[fetchLiveData] No ICAO24 codes provided.');
        return;
    }

    // ✅ Step 1: Filter out aircraft already in cache
    const cache = UnifiedCacheService.getInstance();
    const missingIcao24s = icao24List.filter(icao24 => !cache.get(icao24));
    
    if (missingIcao24s.length === 0) {
        console.log('[fetchLiveData] All requested aircraft are in cache.');
        return;
    }
    
    await manufacturerTracking.fetchLiveAircraft(missingIcao24s);

    try {
        // ✅ Step 2: Use rate-limited polling to fetch missing aircraft
        await pollForActiveAircraft(missingIcao24s, async (data) => {
            console.log(`[fetchLiveData] Received ${data.length} aircraft updates.`);

            for (const aircraft of data) {
                await updateAircraftData(dbManager, positionService, aircraft);
            }

        }, (error) => {
            console.error(`[fetchLiveData] Error fetching aircraft data:`, error);
        });

    } catch (error) {
        console.error('[fetchLiveData] Failed to fetch data from OpenSky:', error);
    }
}

/**
 * ✅ Updates both the database and cache in a single function.
 */
async function updateAircraftData(
    dbManager: TrackingDatabaseManager,
    positionService: AircraftPositionService,
    aircraft: any
): Promise<void> {
    try {
        const { icao24, latitude, longitude, altitude, velocity, heading, on_ground, last_contact } = aircraft;

        if (latitude !== null && longitude !== null) {
            // ✅ Update database first
            await dbManager.upsertActiveAircraft(icao24, {
                latitude,
                longitude,
                altitude,
                velocity,
                heading,
                on_ground,
                last_contact,
            });

            // ✅ Update cache
            positionService.updatePosition({
                icao24,
                latitude,
                longitude,
                altitude,
                velocity,
                heading,
                on_ground,
                last_contact,
            });

            console.log(`[fetchLiveData] Updated ${icao24} in DB & cache.`);
        } else {
            console.warn(`[fetchLiveData] Skipping ${icao24}: Invalid position data.`);
        }
    } catch (error) {
        console.error(`[fetchLiveData] Failed to update ${aircraft.icao24}:`, error);
    }
}
