//utils/aircraft-transform.ts

import type {
  Aircraft,
  AircraftPosition,
  PositionData,
  CachedAircraftData,
  TrackingData,
  OpenSkyStateArray,
  OpenSkyState,
  PartialOpenSkyState,
  ExtendedAircraft,
} from '../types/base';

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
// TypeScript-safe version of OpenSkyTransforms
export const OpenSkyTransforms = {
  validateObjectState(state: unknown): boolean {
    if (!state || typeof state !== 'object') {
      console.log('[OpenSkyTransforms] State is not an object:', state);
      return false;
    }

    const objState = state as Record<string, any>;

    // Check required fields
    if (typeof objState.icao24 !== 'string' || !objState.icao24) {
      console.log('[OpenSkyTransforms] Invalid icao24:', objState.icao24);
      return false;
    }

    if (
      typeof objState.last_contact !== 'number' ||
      isNaN(objState.last_contact)
    ) {
      console.log(
        '[OpenSkyTransforms] Invalid last_contact:',
        objState.last_contact
      );
      return false;
    }

    if (typeof objState.longitude !== 'number' || isNaN(objState.longitude)) {
      console.log('[OpenSkyTransforms] Invalid longitude:', objState.longitude);
      return false;
    }

    if (typeof objState.latitude !== 'number' || isNaN(objState.latitude)) {
      console.log('[OpenSkyTransforms] Invalid latitude:', objState.latitude);
      return false;
    }

    // Check on_ground - use proper type checking
    const onGround = objState.on_ground;
    const isValidOnGround =
      typeof onGround === 'boolean' ||
      (typeof onGround === 'number' && (onGround === 0 || onGround === 1));

    if (!isValidOnGround) {
      console.log('[OpenSkyTransforms] Invalid on_ground:', objState.on_ground);
      return false;
    }

    // Basic validation passed
    return true;
  },

  /**
   * Transform object-format state to Aircraft
   */
  toExtendedAircraftFromObject(
    state: Record<string, any>,
    manufacturer: string
  ): Aircraft {
    try {
      // Add better logging for diagnosis
      console.log(
        `[OpenSkyTransforms] Processing object state for ${state.icao24} from manufacturer: "${manufacturer}"`
      );

      // Check if manufacturer is empty and log a warning
      if (!manufacturer) {
        console.warn(
          '[OpenSkyTransforms] Warning: Empty manufacturer provided for aircraft:',
          state.icao24
        );
      }

      // Convert on_ground to boolean safely
      const onGround = this.convertToBoolean(state.on_ground);

      // Create the aircraft with the provided manufacturer (even if it's an empty string)

      console.log(
        `[OpenSkyTransforms] 🔍 Debugging ICAO24: ${state.icao24}, Manufacturer: "${manufacturer}", Model: "${state.model}"`
      );

      const aircraft = BaseTransforms.normalize({
        icao24: state.icao24,
        latitude: state.latitude,
        longitude: state.longitude,
        altitude: typeof state.altitude === 'number' ? state.altitude : 0,
        velocity: typeof state.velocity === 'number' ? state.velocity : 0,
        heading: typeof state.heading === 'number' ? state.heading : 0,
        on_ground: onGround,
        last_contact:
          typeof state.last_contact === 'number'
            ? state.last_contact
            : Math.floor(Date.now() / 1000),
        // Use the provided manufacturer and ensure it's not empty
        manufacturer: manufacturer || 'Unknown',
        'N-NUMBER': state['N-NUMBER'] || '',
        model: state.model || '',
        NAME: state.NAME || '',
        CITY: state.CITY || '',
        STATE: state.STATE || '',
        TYPE_AIRCRAFT: state.TYPE_AIRCRAFT || '',
        OWNER_TYPE: state.OWNER_TYPE || '',
        isTracked: true,
        lastSeen: state.lastSeen || Date.now(),
      });

      // Log the final manufacturer value for verification
      console.log(
        `[OpenSkyTransforms] Aircraft ${state.icao24} manufacturer set to: "${aircraft.manufacturer}"`
      );

      return aircraft;
    } catch (error) {
      console.error(
        '[OpenSkyTransforms] Error in toExtendedAircraftFromObject:',
        error,
        'for state:',
        state
      );

      // Return a minimal valid aircraft object in case of error
      return BaseTransforms.normalize({
        icao24: typeof state.icao24 === 'string' ? state.icao24 : 'unknown',
        latitude: typeof state.latitude === 'number' ? state.latitude : 0,
        longitude: typeof state.longitude === 'number' ? state.longitude : 0,
        // Make sure manufacturer is passed here too
        manufacturer: manufacturer || 'Unknown',
        isTracked: true,
      });
    }
  },

  toExtendedAircraft(
    state: PartialOpenSkyState,
    manufacturer: string
  ): Aircraft {
    try {
      console.log(
        `[OpenSkyTransforms] Processing state for ${state[0]} from ${manufacturer}`
      );

      // First check if we have a valid ICAO24 code
      if (
        !state ||
        !Array.isArray(state) ||
        typeof state[0] !== 'string' ||
        !state[0]
      ) {
        console.warn(
          '[OpenSkyTransforms] Invalid or missing ICAO24 code:',
          state
        );
        // Return a minimal valid aircraft
        return BaseTransforms.normalize({
          icao24: 'unknown',
          manufacturer: manufacturer || 'Unknown',
          isTracked: true,
          lastSeen: Date.now(),
        });
      }

      // Extract values with safe fallbacks
      const icao24 = String(state[0]).toLowerCase();
      const latitude =
        typeof state[6] === 'number' && !isNaN(state[6]) ? state[6] : 0;
      const longitude =
        typeof state[5] === 'number' && !isNaN(state[5]) ? state[5] : 0;
      const altitude =
        typeof state[7] === 'number' && !isNaN(state[7]) ? state[7] : 0;
      const velocity =
        typeof state[9] === 'number' && !isNaN(state[9]) ? state[9] : 0;
      const heading =
        typeof state[10] === 'number' && !isNaN(state[10]) ? state[10] : 0;
      const onGround = this.convertToBoolean(state[8]);
      const lastContact =
        typeof state[4] === 'number' && !isNaN(state[4])
          ? state[4]
          : Math.floor(Date.now() / 1000);

      // Create aircraft
      const aircraft = BaseTransforms.normalize({
        icao24,
        latitude,
        longitude,
        altitude,
        velocity,
        heading,
        on_ground: onGround,
        last_contact: lastContact,
        manufacturer: manufacturer || 'Unknown',
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

      console.log(
        `[OpenSkyTransforms] Successfully transformed aircraft: ${icao24}`
      );
      return aircraft;
    } catch (error) {
      console.error(
        '[OpenSkyTransforms] Error in toExtendedAircraft:',
        error,
        'for state:',
        state ? state.slice(0, 5) : null
      );

      // Return a minimal valid aircraft object in case of error
      return BaseTransforms.normalize({
        icao24: typeof state[0] === 'string' ? state[0] : `error-${Date.now()}`,
        manufacturer: manufacturer || 'Unknown',
        isTracked: true,
        lastSeen: Date.now(),
      });
    }
  },

  // This method checks if a partial state has enough data to be considered valid
  // It's more forgiving than the strict tuple type validation
  validatePartialState(state: PartialOpenSkyState): boolean {
    if (!Array.isArray(state)) {
      console.warn('[OpenSkyTransforms] State is not an array');
      return false;
    }

    // At minimum, we need a valid ICAO24 code
    if (typeof state[0] !== 'string' || !state[0]) {
      console.warn('[OpenSkyTransforms] Missing valid ICAO24 code');
      return false;
    }

    // Log warnings for missing positional data but don't fail validation
    if (typeof state[5] !== 'number' || isNaN(state[5])) {
      console.warn(`[OpenSkyTransforms] Missing longitude for ${state[0]}`);
    }

    if (typeof state[6] !== 'number' || isNaN(state[6])) {
      console.warn(`[OpenSkyTransforms] Missing latitude for ${state[0]}`);
    }

    // We're being permissive here - as long as we have an ICAO24, we consider it valid
    return true;
  },

  // Keep your existing validateState method for when you need strict validation
  validateState(state: unknown): state is OpenSkyStateArray {
    if (!Array.isArray(state)) return false;
    if (state.length < 17) return false;
    if (typeof state[0] !== 'string' || !state[0]) return false;
    if (typeof state[4] !== 'number' || isNaN(state[4])) return false;
    if (typeof state[5] !== 'number' || isNaN(state[5])) return false;
    if (typeof state[6] !== 'number' || isNaN(state[6])) return false;
    if (typeof state[8] !== 'boolean' && typeof state[8] !== 'number')
      return false;
    return true;
  },

  // Other methods...

  toTrackingData(state: OpenSkyStateArray): Aircraft {
    try {
      // Convert on_ground to boolean safely
      const onGround = this.convertToBoolean(state[8]);

      return BaseTransforms.normalize({
        icao24: state[0],
        latitude: state[6],
        longitude: state[5],
        altitude: typeof state[7] === 'number' ? state[7] : 0,
        velocity: typeof state[9] === 'number' ? state[9] : 0,
        heading: typeof state[10] === 'number' ? state[10] : 0,
        on_ground: onGround,
        last_contact:
          typeof state[4] === 'number'
            ? state[4]
            : Math.floor(Date.now() / 1000),
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
    } catch (error) {
      console.error('[OpenSkyTransforms] Error in toTrackingData:', error);
      return BaseTransforms.createBase();
    }
  },

  // Helper method to safely convert boolean or number to boolean
  convertToBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value === 1;
    }
    return false;
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

/**
 * Convert Aircraft[] to ExtendedAircraft[]
 */
export const transformToExtendedAircraft = (
  aircraft: Aircraft[]
): ExtendedAircraft[] => {
  return aircraft.map((a) => ({
    ...a,
    type: a.TYPE_AIRCRAFT || 'Unknown', // Ensure 'type' exists
    isGovernment: a.OWNER_TYPE === '5', // Ensure 'isGovernment' exists
  }));
};

/**
 * Utility functions to clean and standardize data
 */
export const DataCleanupUtils = {
  /**
   * Remove duplicate keys from an object
   * When JSON is malformed or corrupted, sometimes keys can appear multiple times
   */
  cleanupDuplicateKeys(obj: Record<string, any>): Record<string, any> {
    if (!obj || typeof obj !== 'object') return obj;

    // Create a new clean object
    const cleanObj: Record<string, any> = {};

    // Use a Set to track which keys we've seen
    const seenKeys = new Set<string>();

    // Get all keys from the object
    Object.keys(obj).forEach((key) => {
      // Only process each key once
      if (!seenKeys.has(key)) {
        seenKeys.add(key);

        // If the value is an object, recursively clean it
        if (
          obj[key] &&
          typeof obj[key] === 'object' &&
          !Array.isArray(obj[key])
        ) {
          cleanObj[key] = this.cleanupDuplicateKeys(obj[key]);
        } else {
          cleanObj[key] = obj[key];
        }
      }
    });

    return cleanObj;
  },

  /**
   * Normalize all fields in an aircraft state object
   */
  normalizeStateFields(state: Record<string, any>): Record<string, any> {
    // First clean up any duplicate keys
    const cleanState = this.cleanupDuplicateKeys(state);

    // Ensure all required fields have proper types
    return {
      ...cleanState,
      icao24: String(cleanState.icao24 || ''),
      latitude: Number(cleanState.latitude) || 0,
      longitude: Number(cleanState.longitude) || 0,
      altitude: Number(cleanState.altitude) || 0,
      heading: Number(cleanState.heading) || 0,
      velocity: Number(cleanState.velocity) || 0,
      on_ground: Boolean(cleanState.on_ground),
      last_contact:
        Number(cleanState.last_contact) || Math.floor(Date.now() / 1000),
      lastSeen: Number(cleanState.lastSeen) || Date.now(),
    };
  },
};

// Convenience exports for backward compatibility
export const { createBase: createBaseAircraft, normalize: normalizeAircraft } =
  BaseTransforms;
