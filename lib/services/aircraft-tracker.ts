// lib/services/aircraft-tracker.ts
import axios from 'axios';
import { CacheManager } from '@/lib/services/cache-manager';

export class AircraftTracker {
    private cacheManager: CacheManager<any>;

    constructor(private restUrl: string, cacheTTL: number) {
        this.cacheManager = new CacheManager(cacheTTL);
    }

    async getPositions(icao24s: string[]): Promise<any[]> {
        const cacheKey = icao24s.join(',');
        const cached = this.cacheManager.get(cacheKey);
        if (cached) return cached;

        const response = await axios.get(this.restUrl, { params: { icao24: icao24s.join(',') } });
        const data = response.data.states || [];
        this.cacheManager.set(cacheKey, data);
        return data;
    }

    parseStates(rawStates: any[][]): any[] {
        return rawStates.map(state => {
            const [icao24, _callsign, _country, _timePosition, lastContact, longitude, latitude, altitude, velocity, heading] = state;
    
            if (latitude === null || longitude === null) return null;
    
            return {
                icao24,
                latitude: Number(latitude),
                longitude: Number(longitude),
                altitude: Number(altitude) || 0,
                velocity: Number(velocity) || 0,
                heading: Number(heading) || 0,
                lastContact: Number(lastContact) || Math.floor(Date.now() / 1000),
            };
        }).filter(pos => pos !== null);
    }
    
}


