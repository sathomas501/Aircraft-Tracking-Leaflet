// lib/services/opensky/cache.ts
import NodeCache from 'node-cache';
import { errorHandler, ErrorType } from '../error-handler';
import type { OpenSkyAircraft } from '@/types/opensky';
import type { PositionData } from '@/types/base';

class OpenSkyCache {
    private cache: NodeCache;
    private static instance: OpenSkyCache;
    private readonly DEFAULT_TTL = 15; // 15 seconds

    private constructor() {
        this.cache = new NodeCache({
            stdTTL: this.DEFAULT_TTL,
            checkperiod: 5,
            useClones: false
        });
    }

    public static getInstance(): OpenSkyCache {
        if (!OpenSkyCache.instance) {
            OpenSkyCache.instance = new OpenSkyCache();
        }
        return OpenSkyCache.instance;
    }

    public set(icao24: string, data: PositionData | OpenSkyAircraft): void {
        try {
            this.cache.set(icao24, data);
        } catch (error) {
            errorHandler.handleError(ErrorType.DATA, 'Failed to cache aircraft data', error);
        }
    }

    public get(icao24: string): PositionData | OpenSkyAircraft | undefined {
        try {
            return this.cache.get(icao24);
        } catch (error) {
            errorHandler.handleError(ErrorType.DATA, 'Failed to retrieve aircraft data', error);
            return undefined;
        }
    }

    public getMultiple(icao24s: string[]): Array<PositionData | OpenSkyAircraft> {
        try {
            const results: Array<PositionData | OpenSkyAircraft> = [];
            for (const icao24 of icao24s) {
                const data = this.cache.get<PositionData | OpenSkyAircraft>(icao24);
                if (data) {
                    results.push(data);
                }
            }
            return results;
        } catch (error) {
            errorHandler.handleError(ErrorType.DATA, 'Failed to retrieve multiple aircraft data', error);
            return [];
        }
    }

    public updateFromWebSocket(positions: OpenSkyAircraft[]): void {
        try {
            const updates = positions.reduce((acc, position) => {
                acc[position.icao24] = position;
                return acc;
            }, {} as Record<string, OpenSkyAircraft>);

            this.cache.mset(Object.entries(updates).map(([key, value]) => ({
                key,
                val: value,
                ttl: this.DEFAULT_TTL
            })));
        } catch (error) {
            errorHandler.handleError(ErrorType.DATA, 'Failed to update cache from WebSocket', error);
        }
    }

    public clear(): void {
        try {
            this.cache.flushAll();
        } catch (error) {
            errorHandler.handleError(ErrorType.DATA, 'Failed to clear cache', error);
        }
    }

    public cleanup(): void {
        this.clear();
    }

    // Helper method to get all aircraft currently in cache
    public getAllAircraft(): Array<PositionData | OpenSkyAircraft> {
        try {
            return Object.values(this.cache.mget(this.cache.keys()));
        } catch (error) {
            errorHandler.handleError(ErrorType.DATA, 'Failed to retrieve all aircraft', error);
            return [];
        }
    }

    // Helper method to check if data exists for an aircraft
    public has(icao24: string): boolean {
        return this.cache.has(icao24);
    }

    // Get stats about the cache
    public getStats() {
        return this.cache.getStats();
    }
}

export const openSkyCache = OpenSkyCache.getInstance();