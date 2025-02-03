// types/base.ts

import { OpenSkyError, OpenSkyErrorCode } from '@/lib/services/opensky-errors';
/**
 * Base position interface with latitude and longitude
 */
export interface Position {
  lat: number;
  lng: number;
}

/**
 * Extended position data with optional flight-related information
 */
export interface AircraftPosition extends Position {
  altitude?: number;
  heading?: number;
  velocity?: number;
  on_ground?: boolean;
}

/**
 * Raw position data from OpenSky API
 */
export interface PositionData {
  icao24: string;
  latitude: number;  // Changed from optional to required
  longitude: number; // Changed from optional to required
  velocity?: number;  // Changed from optional to required
  heading?: number;   // Changed from optional to required
  altitude?: number;  // Changed from optional to required
  on_ground: boolean;
  last_contact: number;
  model?: string;
  manufacturer?: string;
  last_seen?: number;  // Adding this for tracking last update time
}

/**
 * Complete aircraft information including registration and tracking data
 */
export interface Aircraft {
  // Core identification
  icao24: string;
  "N-NUMBER": string;
  manufacturer: string;
  model?: string;
  operator?: string;

  // Location and movement data
  latitude: number;
  longitude: number;
  altitude: number;
  heading: number;
  velocity: number;
  on_ground: boolean;
  last_contact: number;
  lastSeen?: number;

  // Registration information
  NAME: string;
  CITY: string;
  STATE: string;
  OWNER_TYPE: string;
  TYPE_AIRCRAFT: string;

  // Tracking state
  isTracked: boolean;
  
  //Optonal fields
  registration?: string;
  manufacturerName?: string;
  owner?: string;
  registered?: string;
  manufacturerIcao?: string;
  operatorIcao?: string;
  active?: boolean;
}


export interface OpenSkyState {
  icao24: string;
  latitude?: number;
  longitude?: number;
  baro_altitude?: number;
  velocity?: number;
  true_track?: number;
  on_ground?: boolean;
  last_contact?: number;

  // Add missing fields
  registration?: string;
  manufacturer?: string;
  name?: string;
  city?: string;
  state?: string;
  type_aircraft?: string;
  owner_type?: string;
  operator?: string;
  isTracked?: boolean;
}


/**
 * Aircraft marker for map display with optional details
 */
export interface AircraftMarker extends AircraftPosition {
  id: string;
  icao24: string;
  registration?: string;
  manufacturerName?: string;
  model?: string;
  operator?: string;
}

/**
 * Historical position trails for aircraft
 */
export interface Trails {
  [icao24: string]: Position[];
}

/**
 * Select option for dropdowns and selectors
 */
export interface SelectOption {
  value: string;
  label: string;
  count?: number;
  activeCount?: number;
}

/**
 * Props for the SimpleMap component
 */
export interface SimpleMapProps {
  onAircraftCountChange?: (count: number) => void;
}

/**
 * Helper type to extract position data from Aircraft
 */
export type AircraftPositionFromAircraft = Pick<
  Aircraft,
  'latitude' | 'longitude' | 'altitude' | 'heading' | 'velocity' | 'on_ground'
>;

export interface AircraftState extends PositionData {
  last_seen: number;  // Required in AircraftState
}

/**
 * Helper function to convert Aircraft to AircraftPosition
 */
export function toAircraftPosition(aircraft: Aircraft): AircraftPosition {
  return {
    lat: aircraft.latitude,
    lng: aircraft.longitude,
    altitude: aircraft.altitude,
    heading: aircraft.heading,
    velocity: aircraft.velocity,
    on_ground: aircraft.on_ground
  };
}

/**
 * Helper function to convert PositionData to AircraftPosition
 */
export function positionDataToAircraftPosition(data: PositionData): AircraftPosition {
  return {
    lat: data.latitude,
    lng: data.longitude,
    altitude: data.altitude,
    heading: data.heading,
    velocity: data.velocity,
    on_ground: data.on_ground
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

// Helper function to create PositionData with required fields
export function createPositionData(
  icao24: string,
  partialData: Required<Omit<PositionData, 'icao24' | 'on_ground' | 'last_contact'>>
): PositionData {
  const currentTime = Math.floor(Date.now() / 1000);
  
  return {
    icao24,
    latitude: partialData.latitude,
    longitude: partialData.longitude,
    altitude: partialData.altitude,
    heading: partialData.heading,
    velocity: partialData.velocity,
    on_ground: false,
    last_contact: currentTime
  };
}

// Helper function to validate position data
export function validatePositionData(data: Partial<PositionData>): data is PositionData {
  return (
    typeof data.icao24 === 'string' &&
    typeof data.latitude === 'number' &&
    typeof data.longitude === 'number' &&
    typeof data.altitude === 'number' &&
    typeof data.heading === 'number' &&
    typeof data.velocity === 'number' &&
    typeof data.on_ground === 'boolean' &&
    typeof data.last_contact === 'number' &&
    !isNaN(data.last_contact)
  );
}

// Helper function to ensure we have a valid timestamp
export function normalizeTimestamp(timestamp: number | undefined): number {
  if (timestamp === undefined || isNaN(timestamp)) {
    return Math.floor(Date.now() / 1000);
  }
  return Math.floor(timestamp);
}

export function mapStateToPosition(state: OpenSkyState): PositionData {
  // Validate required fields
  if (state.latitude === undefined || state.longitude === undefined || 
      state.last_contact === undefined) {
      throw new OpenSkyError(
          'Missing required position data',
          OpenSkyErrorCode.INVALID_DATA
      );
  }

  return {
      icao24: state.icao24,
      latitude: state.latitude,
      longitude: state.longitude,
      altitude: state.baro_altitude ?? 0,  // Default to 0 if undefined
      velocity: state.velocity ?? 0,       // Default to 0 if undefined
      heading: state.true_track ?? 0,      // Default to 0 if undefined
      on_ground: state.on_ground ?? false, // Default to false if undefined
      last_contact: state.last_contact
  };
}

export type TrackingStatusType = 'idle' | 'loading' | 'complete' | 'error';


export interface IActiveCounts {
  active: number;
  total: number;
}

export interface IManufacturer {
  value: string;
  label: string;
  activeCount?: number;
}

export interface ManufacturerData {
  id: number;
  name: string;
  country: string;
  count: number;
  activeCount?: number;
}


/**
 * Cached aircraft data format used in UnifiedCacheService
 */
export interface CachedAircraftData {
  // Core identification
  icao24: string;

  // Position and movement data
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  heading: number;
  on_ground: boolean;

  // Timestamps
  last_contact: number;
  lastSeen: number;
  lastUpdate: number;

  // Static data (optional to allow for partial caching)
  "N-NUMBER"?: string;
  manufacturer?: string;
  model?: string;
  NAME?: string;
  CITY?: string;
  STATE?: string;
  TYPE_AIRCRAFT?: string;
  OWNER_TYPE?: string;
}
/**
 * Tracking data structure for aircraft updates
 */
// ✅ Renamed to AircraftTrackingBatch to represent a batch of aircraft data
export interface AircraftTrackingBatch {
  aircraft: CachedAircraftData[];
}

// ✅ Retain TrackingData for individual aircraft tracking data
export interface TrackingData {
  icao24: string;
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  heading: number;
  on_ground: boolean;
  last_contact: number;
  updated_at: number;
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



