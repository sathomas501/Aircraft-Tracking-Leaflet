// types/regions.ts
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
}

// Predefined regions with their bounding boxes
export const REGIONS: Record<string, Region> = {
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
  },
  SOUTH_AMERICA: {
    id: 'sa',
    name: 'South America',
    bounds: {
      minLat: -60,
      maxLat: 15,
      minLon: -82,
      maxLon: -35
    }
  },
  AFRICA: {
    id: 'af',
    name: 'Africa',
    bounds: {
      minLat: -35,
      maxLat: 37,
      minLon: -18,
      maxLon: 52
    }
  }
};