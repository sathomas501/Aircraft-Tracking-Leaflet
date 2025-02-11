//types/base.ts
/**
 * Basic geographical position
 */
export interface Position {
  lat: number;
  lng: number;
}

/**
 * Extended position with flight data
 */
export interface AircraftPosition extends Position {
  altitude?: number;
  heading?: number;
  velocity?: number;
  on_ground?: boolean;
}

// src/types/aircraft.ts
/**
 * Core aircraft data from OpenSky API
 */
export interface OpenSkyState {
  icao24: string;
  latitude?: number;
  longitude?: number;
  baro_altitude?: number;
  velocity?: number;
  true_track?: number;
  on_ground?: boolean;
  last_contact?: number;
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

export type OpenSkyStateArray = [
  icao24: string, // [0]
  callsign: string, // [1]
  country: string, // [2]
  timePosition: number, // [3]
  lastContact: number, // [4]
  longitude: number, // [5]
  latitude: number, // [6]
  altitude: number, // [7]
  onGround: boolean, // [8]
  velocity: number, // [9]
  heading: number, // [10]
  verticalRate: number, // [11]
  sensors: number[], // [12]
  altitudeGeometric: number, // [13]
  squawk: string, // [14]
  spi: boolean, // [15]
  positionSource: number, // [16]
];

/**
 * Complete aircraft information including registration and tracking data
 */
export interface Aircraft {
  // Core identification
  icao24: string;
  'N-NUMBER': string;
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

  // Optional fields
  registration?: string;
  manufacturerName?: string;
  owner?: string;
  registered?: string;
  manufacturerIcao?: string;
  operatorIcao?: string;
  active?: boolean;
}

/**
 * Position data from OpenSky API
 */
export interface PositionData {
  icao24: string;
  latitude: number;
  longitude: number;
  velocity?: number;
  heading?: number;
  altitude?: number;
  on_ground: boolean;
  last_contact: number;
  model?: string;
  manufacturer?: string;
  last_seen?: number;
}

/**
 * Current state of an aircraft with required last_seen
 */
export interface AircraftState extends PositionData {
  last_seen: number;
}

// src/types/map.ts
/**
 * Aircraft marker for map display
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
 * Props for the SimpleMap component
 */
export interface SimpleMapProps {
  onAircraftCountChange?: (count: number) => void;
}

// src/types/cache.ts
/**
 * Cached aircraft data format
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
  lastUpdated: number;

  // Static data
  'N-NUMBER'?: string;
  manufacturer?: string;
  model?: string;
  NAME?: string;
  CITY?: string;
  STATE?: string;
  TYPE_AIRCRAFT?: string;
  OWNER_TYPE?: string;
}

// src/types/tracking.ts
/**
 * Batch of aircraft tracking data
 */
export interface AircraftTrackingBatch {
  aircraft: CachedAircraftData[];
}

/**
 * Individual aircraft tracking data
 */
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

// src/types/ui.ts
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
 * Status for tracking operations
 */
export type TrackingStatusType = 'idle' | 'loading' | 'complete' | 'error';

/**
 * Active counts interface
 */
export interface IActiveCounts {
  active: number;
  total: number;
}

// src/types/manufacturer.ts
/**
 * Manufacturer information
 */
export interface IManufacturer {
  value: string;
  label: string;
  activeCount?: number;
}

/**
 * Detailed manufacturer data
 */
export interface ManufacturerData {
  id: number;
  name: string;
  country: string;
  count: number;
  activeCount?: number;
}

// src/types/utils.ts
/**
 * Helper type to extract position data from Aircraft
 */
export type AircraftPositionFromAircraft = Pick<
  Aircraft,
  'latitude' | 'longitude' | 'altitude' | 'heading' | 'velocity' | 'on_ground'
>;

export interface SubscriptionManager {
  subscribe: (key: string, callback: (data: Aircraft[]) => void) => () => void;
  unsubscribe: (key: string, callback: (data: Aircraft[]) => void) => void;
  notifySubscribers: (key: string, data: Aircraft[]) => void;
}
