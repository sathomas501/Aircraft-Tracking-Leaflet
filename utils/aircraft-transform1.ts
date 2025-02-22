// lib/utils/aircraft-transform.ts
import type {
  Aircraft,
  AircraftPosition,
  PositionData,
  CachedAircraftData,
  TrackingData,
  OpenSkyStateArray,
  OpenSkyState,
} from '../types/base';
import type { OpenSkyAircraft } from '@/types/opensky';

const DEFAULT_VALUES = {
  STRING: 'Unknown',
  NUMBER: 0,
  BOOL: false,
  EMPTY_STRING: '',
} as const;

/**
 * Base transformer and validation utilities
 */
export const BaseTransforms = {
  createBase(currentTime = Date.now()): Aircraft {
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
  },

  normalize(partialAircraft: Partial<Aircraft>): Aircraft {
    const base = BaseTransforms.createBase(Date.now()); // ✅ Explicit reference

    return {
      ...base,
      ...partialAircraft,
      icao24: partialAircraft.icao24 || base.icao24,
      'N-NUMBER': partialAircraft['N-NUMBER'] || base['N-NUMBER'],
      manufacturer: partialAircraft.manufacturer || base.manufacturer,
      latitude: partialAircraft.latitude ?? base.latitude ?? 0, // Ensure valid coords
      longitude: partialAircraft.longitude ?? base.longitude ?? 0,
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
  },
};

export const transformAircraft = (aircraft: Aircraft[]): Aircraft[] => {
  return aircraft.map((plane) => ({
    ...plane,
    isTracked: plane.isTracked ?? false, // Ensure all Aircraft have `isTracked`
  }));
};

/**
 * OpenSky-specific transformations and validations
 */
export const OpenSkyTransforms = {
  validateState(state: unknown): state is OpenSkyStateArray {
    if (!Array.isArray(state)) return false;

    return (
      typeof state[0] === 'string' && // icao24
      typeof state[4] === 'number' && // last_contact
      typeof state[5] === 'number' && // longitude
      typeof state[6] === 'number' && // latitude
      (state[8] === true || state[8] === false) // on_ground must be boolean
    );
  },

  toTrackingData(state: OpenSkyStateArray): Aircraft {
    return BaseTransforms.normalize({
      icao24: state[0],
      latitude: state[6],
      longitude: state[5],
      altitude: state[7] || 0,
      velocity: state[9] || 0,
      heading: state[10] || 0,
      on_ground: state[8] || false,
      last_contact: state[4] || Math.floor(Date.now() / 1000),
      manufacturer: '',
      'N-NUMBER': '',
      model: '',
      NAME: '',
      CITY: '',
      STATE: '',
      TYPE_AIRCRAFT: '',
      OWNER_TYPE: '',
      isTracked: true,
    });
  },

  toExtendedAircraft(state: OpenSkyStateArray, manufacturer: string): Aircraft {
    return BaseTransforms.normalize({
      icao24: state[0],
      latitude: state[6],
      longitude: state[5],
      altitude: state[7] || 0,
      velocity: state[9] || 0,
      heading: state[10] || 0,
      on_ground: state[8] || false,
      last_contact: state[4] || Math.floor(Date.now() / 1000),
      manufacturer,
      'N-NUMBER': '',
      model: '',
      NAME: '',
      CITY: '',
      STATE: '',
      TYPE_AIRCRAFT: '',
      OWNER_TYPE: '',
      isTracked: true,
      lastSeen: Date.now(),
    });
  },
};

/**
 * Cache-related transformations
 */
export const CacheTransforms = {
  toCache(aircraft: Aircraft): CachedAircraftData {
    return {
      icao24: aircraft.icao24,
      'N-NUMBER': aircraft['N-NUMBER'],
      manufacturer: aircraft.manufacturer,
      model: aircraft.model,
      latitude: aircraft.latitude,
      longitude: aircraft.longitude,
      altitude: aircraft.altitude,
      velocity: aircraft.velocity,
      heading: aircraft.heading,
      on_ground: aircraft.on_ground,
      last_contact: aircraft.last_contact,
      lastSeen: aircraft.lastSeen || Date.now(),
      lastUpdated: Date.now(),
      NAME: aircraft.NAME,
      CITY: aircraft.CITY,
      STATE: aircraft.STATE,
      TYPE_AIRCRAFT: aircraft.TYPE_AIRCRAFT,
      OWNER_TYPE: aircraft.OWNER_TYPE,
    };
  },

  fromCache(cached: CachedAircraftData): Aircraft {
    return BaseTransforms.normalize({
      ...cached,
      isTracked: true,
    });
  },
};

/**
 * Database-related transformations
 */
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
    return aircraft.map(this.toTracking);
  },
};

export class OpenSkyError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'OpenSkyError';
  }
}

export const OpenSkyUtils = {
  stateToPosition(state: OpenSkyState): AircraftPosition | null {
    if (!state.latitude || !state.longitude) return null;

    return {
      lat: state.latitude,
      lng: state.longitude,
      altitude: state.baro_altitude,
      heading: state.true_track,
      velocity: state.velocity,
      on_ground: state.on_ground,
    };
  },

  hasValidPosition(state: OpenSkyState): boolean {
    return (
      typeof state.latitude === 'number' &&
      typeof state.longitude === 'number' &&
      !isNaN(state.latitude) &&
      !isNaN(state.longitude)
    );
  },

  mergeWithAircraft(
    state: OpenSkyState,
    aircraft: Partial<Aircraft>
  ): Aircraft {
    const currentTime = Math.floor(Date.now() / 1000);
    return {
      icao24: state.icao24,
      latitude: state.latitude ?? 0,
      longitude: state.longitude ?? 0,
      altitude: state.baro_altitude ?? 0,
      heading: state.true_track ?? 0,
      velocity: state.velocity ?? 0,
      on_ground: Boolean(state.on_ground),
      last_contact: state.last_contact ?? currentTime,
      'N-NUMBER': aircraft['N-NUMBER'] ?? '',
      manufacturer: aircraft.manufacturer ?? '',
      model: aircraft.model ?? '',
      operator: aircraft.operator ?? '',
      OWNER_TYPE: aircraft.OWNER_TYPE ?? '',
      TYPE_AIRCRAFT: aircraft.TYPE_AIRCRAFT ?? '',
      NAME: aircraft.NAME ?? '',
      CITY: aircraft.CITY ?? '',
      STATE: aircraft.STATE ?? '',
      isTracked: aircraft.isTracked ?? false,
    };
  },
};

export function isOpenSkyState(value: unknown): value is OpenSkyState {
  return (
    typeof value === 'object' &&
    value !== null &&
    'icao24' in value &&
    typeof (value as OpenSkyState).icao24 === 'string' &&
    'last_contact' in value &&
    typeof (value as OpenSkyState).last_contact === 'number' &&
    'on_ground' in value &&
    typeof (value as OpenSkyState).on_ground === 'boolean'
  );
}

export function isValidPositionData(data: unknown): data is PositionData {
  return (
    data !== null &&
    typeof data === 'object' &&
    'icao24' in data &&
    typeof (data as PositionData).icao24 === 'string' &&
    'latitude' in data &&
    typeof (data as PositionData).latitude === 'number' &&
    'longitude' in data &&
    typeof (data as PositionData).longitude === 'number' &&
    'on_ground' in data &&
    typeof (data as PositionData).on_ground === 'boolean' &&
    'last_contact' in data &&
    typeof (data as PositionData).last_contact === 'number' &&
    !isNaN((data as PositionData).latitude) &&
    !isNaN((data as PositionData).longitude) &&
    !isNaN((data as PositionData).last_contact) &&
    (data as PositionData).latitude >= -90 &&
    (data as PositionData).latitude <= 90 &&
    (data as PositionData).longitude >= -180 &&
    (data as PositionData).longitude <= 180
  );
}

export function parsePositionData(rawData: unknown[]): PositionData | null {
  if (!Array.isArray(rawData) || rawData.length < 17) return null;

  const [
    icao24,
    _callsign,
    _origin_country,
    _time_position,
    last_contact,
    longitude,
    latitude,
    _baro_altitude,
    on_ground,
    velocity,
    heading,
    _vertical_rate,
    _sensors,
    altitude,
  ] = rawData;

  if (
    typeof icao24 !== 'string' ||
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    isNaN(latitude) ||
    isNaN(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return {
    icao24,
    latitude,
    longitude,
    altitude: typeof altitude === 'number' && !isNaN(altitude) ? altitude : 0,
    velocity: typeof velocity === 'number' && !isNaN(velocity) ? velocity : 0,
    heading: typeof heading === 'number' && !isNaN(heading) ? heading : 0,
    on_ground: Boolean(on_ground),
    last_contact: Math.floor(Number(last_contact) || Date.now() / 1000),
  };
}

// Convenience exports for backward compatibility
export const { createBase: createBaseAircraft, normalize: normalizeAircraft } =
  BaseTransforms;
