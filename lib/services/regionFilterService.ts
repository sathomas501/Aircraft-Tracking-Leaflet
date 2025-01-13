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
        bounds: {
            minLat: -90,
            maxLat: 90,
            minLon: -180,
            maxLon: 180
        },
        description: 'Worldwide coverage'
    },
    NORTH_AMERICA: {
        id: 'na',
        name: 'North America',
        bounds: {
            minLat: 15,
            maxLat: 72,
            minLon: -168,
            maxLon: -50
        }
    },
    EUROPE: {
        id: 'eu',
        name: 'Europe',
        bounds: {
            minLat: 35,
            maxLat: 72,
            minLon: -10,
            maxLon: 40
        }
    },
    ASIA: {
        id: 'as',
        name: 'Asia',
        bounds: {
            minLat: 0,
            maxLat: 75,
            minLon: 40,
            maxLon: 180
        }
    },
    OCEANIA: {
        id: 'oc',
        name: 'Oceania',
        bounds: {
            minLat: -50,
            maxLat: 0,
            minLon: 110,
            maxLon: 180
        }
    }
} as const;

export class RegionFilterService {
    static isInBounds(lat: number | undefined, lon: number | undefined, bounds: BoundingBox): boolean {
        if (lat === undefined || lon === undefined) return false;
        
        return (
            lat >= bounds.minLat &&
            lat <= bounds.maxLat &&
            lon >= bounds.minLon &&
            lon <= bounds.maxLon
        );
    }

    static getRegionForCoordinates(lat: number, lon: number): string {
        for (const [regionKey, region] of Object.entries(REGIONS)) {
            if (this.isInBounds(lat, lon, region.bounds)) {
                return region.id;
            }
        }
        return 'unknown';
    }

    static getBoundsFromRegions(regionIds: string[]): BoundingBox | null {
        if (regionIds.length === 0) return null;

        const regions = regionIds
            .map(id => REGIONS[id.toUpperCase()])
            .filter(Boolean);

        if (regions.length === 0) return null;

        return {
            minLat: Math.min(...regions.map(r => r.bounds.minLat)),
            maxLat: Math.max(...regions.map(r => r.bounds.maxLat)),
            minLon: Math.min(...regions.map(r => r.bounds.minLon)),
            maxLon: Math.max(...regions.map(r => r.bounds.maxLon))
        };
    }

    static getSQLBoundsCondition(tableAlias: string = 'aa'): string {
        return `
            ${tableAlias}.latitude >= ? AND 
            ${tableAlias}.latitude <= ? AND 
            ${tableAlias}.longitude >= ? AND 
            ${tableAlias}.longitude <= ?
        `;
    }

    static getBoundsParams(bounds: BoundingBox): [number, number, number, number] {
        return [
            bounds.minLat,
            bounds.maxLat,
            bounds.minLon,
            bounds.maxLon
        ];
    }

    static getAllRegions(): Region[] {
        return Object.values(REGIONS);
    }

    static getRegionById(id: string): Region | undefined {
        return REGIONS[id.toUpperCase()];
    }
}