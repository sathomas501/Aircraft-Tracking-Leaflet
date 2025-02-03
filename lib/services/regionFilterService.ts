// lib/services/regionFilterService.ts

export interface BoundingBox {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
}

export interface Region {
    id: string;
    name: string;
    bounds: BoundingBox;
    description?: string;
}

export const REGIONS: Record<string, Region> = {
    GLOBAL: {
        id: 'global',
        name: 'Global',
        bounds: { minLat: -90, maxLat: 90, minLon: -180, maxLon: 180 },
        description: 'Worldwide coverage'
    },
    NORTH_AMERICA: {
        id: 'na',
        name: 'North America',
        bounds: { minLat: 15, maxLat: 72, minLon: -168, maxLon: -50 }
    },
    EUROPE: {
        id: 'eu',
        name: 'Europe',
        bounds: { minLat: 35, maxLat: 72, minLon: -10, maxLon: 40 }
    },
    ASIA: {
        id: 'as',
        name: 'Asia',
        bounds: { minLat: 0, maxLat: 75, minLon: 40, maxLon: 180 }
    },
    OCEANIA: {
        id: 'oc',
        name: 'Oceania',
        bounds: { minLat: -50, maxLat: 0, minLon: 110, maxLon: 180 }
    }
} as const;

export class RegionFilterService {
    static isInBounds(bounds: BoundingBox, lat?: number, lon?: number): boolean {
        return (
            lat !== undefined &&
            lon !== undefined &&
            lat >= bounds.minLat &&
            lat <= bounds.maxLat &&
            lon >= bounds.minLon &&
            lon <= bounds.maxLon
        );
    }
    

    static getRegionForCoordinates(lat: number, lon: number): string {
        return Object.values(REGIONS).find(region =>
            this.isInBounds(region.bounds, lat, lon)
        )?.id || 'unknown';
    }

    static getBoundsFromRegions(regionIds: string[]): BoundingBox | null {
        const regions = regionIds
            .map(id => REGIONS[id.toUpperCase()])
            .filter((region): region is Region => Boolean(region));

        if (regions.length === 0) return null;

        return regions.reduce<BoundingBox>((acc, region) => ({
            minLat: Math.min(acc.minLat, region.bounds.minLat),
            maxLat: Math.max(acc.maxLat, region.bounds.maxLat),
            minLon: Math.min(acc.minLon, region.bounds.minLon),
            maxLon: Math.max(acc.maxLon, region.bounds.maxLon),
        }), regions[0].bounds);
    }

    static getSQLBoundsCondition(tableAlias: string = 'aa'): string {
        return `
            ${tableAlias}.latitude BETWEEN ? AND ? AND 
            ${tableAlias}.longitude BETWEEN ? AND ?
        `;
    }

    static getBoundsParams(bounds: BoundingBox): [number, number, number, number] {
        return [bounds.minLat, bounds.maxLat, bounds.minLon, bounds.maxLon];
    }

    static getAllRegions(): Region[] {
        return Object.values(REGIONS);
    }

    static getRegionById(id: string): Region | undefined {
        return REGIONS[id.toUpperCase()];
    }
}
