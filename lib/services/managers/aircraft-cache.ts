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

    getLatestData(): { aircraft: OpenSkyAircraft[] } {
        return { aircraft: Array.from(this.cache.values()) };
    }

    getRegionData(description: string): CachedRegionData | null {
        return this.regionData.get(description) || null;
    }

    clearCache(): void {
        console.log('[Cache] Clearing cache in AircraftCache');
        this.cache.clear();
        this.regionData.clear();
    }
}

// Export the singleton instance directly
export const aircraftCache = new AircraftCache();
