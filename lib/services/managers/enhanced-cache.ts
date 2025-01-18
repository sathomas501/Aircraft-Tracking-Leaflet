// lib/services/enhanced-cache.ts
import type { Aircraft } from '@/types/base';

class EnhancedCache {
    private static instance: EnhancedCache;
    private cache: Map<string, { data: Aircraft; timestamp: number }> = new Map();
    private readonly TTL = 30000; // 30 seconds

    private constructor() {}

    static getInstance(): EnhancedCache {
        if (!EnhancedCache.instance) {
            EnhancedCache.instance = new EnhancedCache();
        }
        return EnhancedCache.instance;
    }

    async get(icao24: string): Promise<Aircraft | null> {
        const entry = this.cache.get(icao24);
        if (!entry) return null;

        if (Date.now() - entry.timestamp > this.TTL) {
            this.cache.delete(icao24);
            return null;
        }

        return entry.data;
    }

    set(icao24: string, data: Aircraft): void {
        this.cache.set(icao24, {
            data,
            timestamp: Date.now()
        });
    }

    update(aircraft: Aircraft[]): void {
        const now = Date.now();
        aircraft.forEach(plane => {
            this.cache.set(plane.icao24, {
                data: plane,
                timestamp: now
            });
        });
    }

    getLatestData(): Aircraft[] {
        return this.getAllAircraft();
    }

    getAllAircraft(): Aircraft[] {
        const now = Date.now();
        const aircraft: Aircraft[] = [];

        this.cache.forEach((entry, icao24) => {
            if (now - entry.timestamp <= this.TTL) {
                aircraft.push(entry.data);
            } else {
                this.cache.delete(icao24);
            }
        });

        return aircraft;
    }

    clear(): void {
        this.cache.clear();
    }
}

export const enhancedCache = EnhancedCache.getInstance();