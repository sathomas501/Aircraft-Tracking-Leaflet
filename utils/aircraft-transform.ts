// lib/utils/aircraft-transform.ts
import type {
  Aircraft,
  PositionData,
  OpenSkyState,
  CachedAircraftData,
  TrackingData,
} from '@/types/base';
import type { OpenSkyAircraft } from '@/types/opensky';

const DEFAULT_VALUES = {
  STRING: 'Unknown',
  NUMBER: 0,
  BOOL: false,
  EMPTY_STRING: '',
} as const;

/**
 * Base transformer that ensures all required Aircraft fields are present
 */
function createBaseAircraft(currentTime = Date.now()): Aircraft {
  return {
    icao24: DEFAULT_VALUES.EMPTY_STRING,
    'N-NUMBER': DEFAULT_VALUES.STRING,
    manufacturer: DEFAULT_VALUES.STRING,
    model: DEFAULT_VALUES.STRING,
    operator: DEFAULT_VALUES.STRING,
    latitude: DEFAULT_VALUES.NUMBER,
    longitude: DEFAULT_VALUES.NUMBER,
    altitude: DEFAULT_VALUES.NUMBER,
    heading: DEFAULT_VALUES.NUMBER,
    velocity: DEFAULT_VALUES.NUMBER,
    on_ground: DEFAULT_VALUES.BOOL,
    last_contact: Math.floor(currentTime / 1000),
    NAME: DEFAULT_VALUES.STRING,
    CITY: DEFAULT_VALUES.STRING,
    STATE: DEFAULT_VALUES.STRING,
    TYPE_AIRCRAFT: DEFAULT_VALUES.STRING,
    OWNER_TYPE: DEFAULT_VALUES.STRING,
    isTracked: DEFAULT_VALUES.BOOL,
    lastSeen: currentTime,
  };
}

/**
 * Normalizes any partial Aircraft data into a complete Aircraft object
 */
export function normalizeAircraft(
  partialAircraft: Partial<Aircraft>
): Aircraft {
  const base = createBaseAircraft(Date.now());

  return {
    ...base,
    ...partialAircraft,
    // Ensure required fields are never undefined
    icao24: partialAircraft.icao24 || base.icao24,
    'N-NUMBER': partialAircraft['N-NUMBER'] || base['N-NUMBER'],
    manufacturer: partialAircraft.manufacturer || base.manufacturer,
    latitude: partialAircraft.latitude ?? base.latitude,
    longitude: partialAircraft.longitude ?? base.longitude,
    altitude: partialAircraft.altitude ?? base.altitude,
    heading: partialAircraft.heading ?? base.heading,
    velocity: partialAircraft.velocity ?? base.velocity,
    on_ground: partialAircraft.on_ground ?? base.on_ground,
    last_contact: partialAircraft.last_contact || base.last_contact,
    NAME: partialAircraft.NAME || base.NAME,
    CITY: partialAircraft.CITY || base.CITY,
    STATE: partialAircraft.STATE || base.STATE,
    TYPE_AIRCRAFT: partialAircraft.TYPE_AIRCRAFT || base.TYPE_AIRCRAFT,
    OWNER_TYPE: partialAircraft.OWNER_TYPE || base.OWNER_TYPE,
    isTracked: partialAircraft.isTracked ?? base.isTracked,
  };
}

// Export existing transform functions for backward compatibility
export const transformOpenSkyState = (state: any[]): Aircraft =>
  AircraftTransforms.fromOpenSkyState(state);

export const transformPositionData = (position: PositionData): Aircraft =>
  AircraftTransforms.fromPosition(position);

export const transformOpenSkyAircraft = (aircraft: OpenSkyAircraft): Aircraft =>
  AircraftTransforms.fromOpenSky(aircraft);

export const transformFromCache = (cached: CachedAircraftData): Aircraft =>
  CacheTransforms.fromCache(cached);

export const transformToCache = (aircraft: Aircraft): CachedAircraftData =>
  CacheTransforms.toCache(aircraft);

export const transformPositionBatch = (positions: PositionData[]): Aircraft[] =>
  positions.map(AircraftTransforms.fromPosition);

// Main transform namespaces
export const AircraftTransforms = {
  createBase: createBaseAircraft,
  normalize: normalizeAircraft,

  fromOpenSkyState(state: any[]): Aircraft {
    return normalizeAircraft({
      icao24: state[0],
      latitude: state[6],
      longitude: state[5],
      altitude: state[7],
      heading: state[10],
      velocity: state[9],
      on_ground: state[8],
      last_contact: state[4],
      lastSeen: Date.now(),
      isTracked: true,
    });
  },

  fromPosition(position: PositionData): Aircraft {
    return normalizeAircraft({
      icao24: position.icao24,
      latitude: position.latitude,
      longitude: position.longitude,
      altitude: position.altitude,
      heading: position.heading,
      velocity: position.velocity,
      on_ground: position.on_ground,
      last_contact: position.last_contact,
      lastSeen: position.last_seen || Date.now(),
      isTracked: true,
    });
  },

  fromOpenSky(aircraft: OpenSkyAircraft): Aircraft {
    return normalizeAircraft({
      icao24: aircraft.icao24,
      manufacturer: aircraft.manufacturer,
      model: aircraft.model,
      latitude: aircraft.latitude,
      longitude: aircraft.longitude,
      altitude: aircraft.altitude,
      heading: aircraft.heading,
      velocity: aircraft.velocity,
      on_ground: aircraft.on_ground,
      last_contact: aircraft.last_contact,
      lastSeen: Date.now(),
      isTracked: true,
    });
  },
};

export const CacheTransforms = {
  toCache(aircraft: Aircraft): CachedAircraftData {
    return {
      icao24: aircraft.icao24,
      latitude: aircraft.latitude,
      longitude: aircraft.longitude,
      altitude: aircraft.altitude,
      velocity: aircraft.velocity,
      heading: aircraft.heading,
      on_ground: aircraft.on_ground,
      last_contact: aircraft.last_contact,
      lastSeen: aircraft.lastSeen || Date.now(),
      lastUpdate: Date.now(),
      'N-NUMBER': aircraft['N-NUMBER'],
      manufacturer: aircraft.manufacturer,
      model: aircraft.model,
      NAME: aircraft.NAME,
      CITY: aircraft.CITY,
      STATE: aircraft.STATE,
      TYPE_AIRCRAFT: aircraft.TYPE_AIRCRAFT,
      OWNER_TYPE: aircraft.OWNER_TYPE,
    };
  },

  fromCache(cached: CachedAircraftData): Aircraft {
    return normalizeAircraft({
      icao24: cached.icao24,
      latitude: cached.latitude,
      longitude: cached.longitude,
      altitude: cached.altitude,
      heading: cached.heading,
      velocity: cached.velocity,
      on_ground: cached.on_ground,
      last_contact: cached.last_contact,
      lastSeen: cached.lastSeen,
      'N-NUMBER': cached['N-NUMBER'],
      manufacturer: cached.manufacturer,
      model: cached.model,
      NAME: cached.NAME,
      CITY: cached.CITY,
      STATE: cached.STATE,
      TYPE_AIRCRAFT: cached.TYPE_AIRCRAFT,
      OWNER_TYPE: cached.OWNER_TYPE,
      isTracked: true,
    });
  },
};

export const DatabaseTransforms = {
  toTracking(aircraft: Aircraft): TrackingData {
    return {
      icao24: aircraft.icao24,
      latitude: aircraft.latitude,
      longitude: aircraft.longitude,
      altitude: aircraft.altitude,
      velocity: aircraft.velocity,
      heading: aircraft.heading,
      on_ground: aircraft.on_ground,
      last_contact: aircraft.last_contact,
      updated_at: Date.now(),
    };
  },

  toBatch(aircraft: Aircraft[]): TrackingData[] {
    return aircraft.map((a) => this.toTracking(a));
  },
};

export const transformAircraft = (aircraft: Aircraft[]): Aircraft[] => {
  return aircraft.map((plane) => ({
    ...plane,
    isTracked: plane.isTracked ?? false, // Ensure all Aircraft have `isTracked`
  }));
};
