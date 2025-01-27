import axios from 'axios';
import { TrackingDatabaseManager } from '../db/trackingDatabaseManager';

export async function fetchLiveData(icao24List: string[]): Promise<void> {
    const dbManager = TrackingDatabaseManager.getInstance();

    if (icao24List.length === 0) {
        console.warn('[fetchLiveData] No ICAO24 codes provided.');
        return;
    }

    try {
        const response = await axios.get('https://opensky-network.org/api/states/all', {
            params: { icao24: icao24List.join(',') },
            headers: { 'Content-Type': 'application/json' },
        });

        const liveData = response.data.states || [];
        for (const aircraft of liveData) {
            const [icao24, , , , , longitude, latitude, altitude, , velocity, heading] = aircraft;

            if (latitude !== null && longitude !== null) {
                await dbManager.upsertActiveAircraft(icao24, {
                    latitude,
                    longitude,
                    altitude,
                    velocity,
                    heading,
                    last_contact: Date.now(),
                });
            } else {
                console.warn(`[fetchLiveData] Skipping aircraft with invalid coordinates: ${icao24}`);
            }
        }
    } catch (error) {
        console.error('[fetchLiveData] Error fetching data from OpenSky:', error);
    }
}
