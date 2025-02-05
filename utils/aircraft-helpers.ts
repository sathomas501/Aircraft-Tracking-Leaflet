// utils/aircraft-helpers.ts
import type { Aircraft, PositionData, OpenSkyState } from '@/types/base';
import type {  OpenSkyAircraft } from '@/types/opensky';
import type { CachedAircraftData } from '@/types/base';
import { OpenSkyError, OpenSkyErrorCode } from '@/lib/services/opensky-errors';

export function normalizeAircraft(partialAircraft: Partial<Aircraft>): Aircraft {
    const currentTime = Math.floor(Date.now() / 1000);
    
    return {
        // Required fields with defaults
        icao24: partialAircraft.icao24 || '',
        "N-NUMBER": partialAircraft["N-NUMBER"] || "Unknown",
        manufacturer: partialAircraft.manufacturer || "Unknown",
        latitude: partialAircraft.latitude || 0,
        longitude: partialAircraft.longitude || 0,
        altitude: partialAircraft.altitude || 0,
        heading: partialAircraft.heading || 0,
        velocity: partialAircraft.velocity || 0,
        on_ground: partialAircraft.on_ground || false,
        last_contact: partialAircraft.last_contact || currentTime,
        NAME: partialAircraft.NAME || "Unknown",
        CITY: partialAircraft.CITY || "Unknown",
        STATE: partialAircraft.STATE || "Unknown",
        TYPE_AIRCRAFT: partialAircraft.TYPE_AIRCRAFT || "Unknown",
        OWNER_TYPE: partialAircraft.OWNER_TYPE || "Unknown",
        isTracked: partialAircraft.isTracked || false,

        // Optional fields
        model: partialAircraft.model,
        operator: partialAircraft.operator,
        lastSeen: partialAircraft.lastSeen,
        registration: partialAircraft.registration,
        manufacturerName: partialAircraft.manufacturerName,
        owner: partialAircraft.owner,
        registered: partialAircraft.registered,
        manufacturerIcao: partialAircraft.manufacturerIcao,
        operatorIcao: partialAircraft.operatorIcao,
        active: partialAircraft.active
    };
}

export function positionDataToAircraft(posData: PositionData): Aircraft {
    return normalizeAircraft({
        icao24: posData.icao24,
        latitude: posData.latitude,
        longitude: posData.longitude,
        altitude: posData.altitude,
        heading: posData.heading,
        velocity: posData.velocity,
        on_ground: posData.on_ground,
        last_contact: posData.last_contact,
        isTracked: true,
        // Add required fields with defaults
        "N-NUMBER": "Unknown",
        manufacturer: "Unknown",
        NAME: "Unknown",
        CITY: "Unknown",
        STATE: "Unknown",
        TYPE_AIRCRAFT: "Unknown",
        OWNER_TYPE: "Unknown"
    });
}

export function positionToAircraft(position: PositionData): Aircraft {
    return {
        icao24: position.icao24,
        "N-NUMBER": "",
        manufacturer: "Unknown",
        model: "Unknown",
        operator: "Unknown",
        latitude: position.latitude,
        longitude: position.longitude,
        altitude: position.altitude || 0,  // Provide default value
        heading: position.heading || 0,    // Provide default value
        velocity: position.velocity || 0,  // Provide default value
        on_ground: position.on_ground,
        last_contact: position.last_contact,
        TYPE_AIRCRAFT: "",
        OWNER_TYPE: "",
        NAME: "",
        CITY: "",
        STATE: "",
        isTracked: true
    };
}

export function openSkyToAircraft(aircraft: OpenSkyAircraft): Aircraft {
    return {
        icao24: aircraft.icao24,
        "N-NUMBER": "",
        manufacturer: aircraft.manufacturer || "Unknown",
        model: aircraft.model || "Unknown",
        operator: "Unknown",
        latitude: aircraft.latitude ?? 0,    // Use nullish coalescing
        longitude: aircraft.longitude ?? 0,  // Use nullish coalescing
        altitude: aircraft.altitude ?? 0,    // Use nullish coalescing
        heading: aircraft.heading ?? 0,      // Use nullish coalescing
        velocity: aircraft.velocity ?? 0,    // Use nullish coalescing
        on_ground: aircraft.on_ground,
        last_contact: aircraft.last_contact,
        OWNER_TYPE: "",
        TYPE_AIRCRAFT: "",
        NAME: "",
        CITY: "",
        STATE: "",
        isTracked: true
    };
}

export function mapStateToAircraft(state: OpenSkyState): Aircraft {
  return {
      icao24: state.icao24,
      "N-NUMBER": "",
      manufacturer: "Unknown",
      model: "Unknown",
      altitude: state.baro_altitude ?? 0,
      latitude: state.latitude ?? 0,
      longitude: state.longitude ?? 0,
      velocity: state.velocity ?? 0,
      heading: state.true_track ?? 0,
      on_ground: state.on_ground ?? false,
      last_contact: state.last_contact ?? Date.now(),
      NAME: "Unknown",
      CITY: "Unknown",
      STATE: "Unknown",
      OWNER_TYPE: "Unknown",
      TYPE_AIRCRAFT: "Unknown",
      isTracked: false,
  };
}

export function transformToAircraft(cached: CachedAircraftData): Aircraft {
  return {
    // Core identification
    icao24: cached.icao24,
    "N-NUMBER": cached["N-NUMBER"] || "",
    manufacturer: cached.manufacturer || "",
    model: cached.model || "",
    
    // Position and movement data
    latitude: cached.latitude,
    longitude: cached.longitude,
    altitude: cached.altitude,
    heading: cached.heading,
    velocity: cached.velocity,
    on_ground: cached.on_ground,
    last_contact: cached.last_contact,
    lastSeen: cached.lastSeen,
    
    // Static data
    NAME: cached.NAME || "",
    CITY: cached.CITY || "",
    STATE: cached.STATE || "",
    TYPE_AIRCRAFT: cached.TYPE_AIRCRAFT || "",
    OWNER_TYPE: cached.OWNER_TYPE || "",
    
    // Always set tracked to true for active aircraft
    isTracked: true
  };
}

/**
 * Helper function to transform Aircraft to CachedAircraftData
 */
export function transformToCachedData(aircraft: Aircraft): CachedAircraftData {
    const now = Date.now();
    return {
      // Core identification
      icao24: aircraft.icao24,
      
      // Position and movement data
      latitude: aircraft.latitude,
      longitude: aircraft.longitude,
      altitude: aircraft.altitude,
      velocity: aircraft.velocity,
      heading: aircraft.heading,
      on_ground: aircraft.on_ground,
      
      // Timestamps
      last_contact: aircraft.last_contact,
      lastSeen: aircraft.lastSeen || now,
      lastUpdate: now,
      
      // Preserve all static data
      "N-NUMBER": aircraft["N-NUMBER"],
      manufacturer: aircraft.manufacturer,
      model: aircraft.model,
      NAME: aircraft.NAME,
      CITY: aircraft.CITY,
      STATE: aircraft.STATE,
      TYPE_AIRCRAFT: aircraft.TYPE_AIRCRAFT,
      OWNER_TYPE: aircraft.OWNER_TYPE
    };
}

export function mapPositionDataToAircraft(positionData: PositionData[]): Aircraft[] {
    return positionData.map((data) => ({
        icao24: data.icao24,
        "N-NUMBER": "",
        manufacturer: "Unknown",
        model: "Unknown",
        operator: "Unknown",
        latitude: data.latitude,
        longitude: data.longitude,
        altitude: data.altitude ?? -1,
        heading: data.heading ?? 0,  // Provide default value for heading
        velocity: data.velocity ?? 0,
        on_ground: data.on_ground,
        last_contact: data.last_contact,
        NAME: "",
        CITY: "",
        STATE: "",
        TYPE_AIRCRAFT: "Unknown",
        OWNER_TYPE: "Unknown",
        isTracked: true
    }));
  }