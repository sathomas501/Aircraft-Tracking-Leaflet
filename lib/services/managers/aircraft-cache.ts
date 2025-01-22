//lib/services/managers/aircraft-cache.ts

import type { OpenSkyAircraft } from '@/types/opensky';

export interface CachedRegionData {
    description: string;
    aircraft: OpenSkyAircraft[];
}

class AircraftCache {
    private cache: Map<string, OpenSkyAircraft> = new Map();
    private regionData: Map<string, CachedRegionData> = new Map();

    updateFromWebSocket(data: OpenSkyAircraft[]): void {
        data.forEach(aircraft => {
            this.cache.set(aircraft.icao24, aircraft);
        });
    }

    updateFromRest(description: string, data: OpenSkyAircraft[]): void {
        this.regionData.set(description, { description, aircraft: data });
        data.forEach(aircraft => {
            this.cache.set(aircraft.icao24, aircraft);
        });
    }

    clearRegion(description: string): void {
        const regionData = this.regionData.get(description);
        if (regionData) {
            // Remove aircraft in this region from the main cache
            regionData.aircraft.forEach(aircraft => {
                this.cache.delete(aircraft.icao24);
            });
            this.regionData.delete(description);
        }
    }

    getLatestData(): { aircraft: OpenSkyAircraft[] } {
        return { aircraft: Array.from(this.cache.values()) };
    }

    getRegionData(description: string): CachedRegionData | null {
        return this.regionData.get(description) || null;
    }

    clearCache(): void {
        this.cache.clear();
        this.regionData.clear();
    }
}

export const aircraftCache = new AircraftCache();