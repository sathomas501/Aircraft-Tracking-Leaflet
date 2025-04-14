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

/**
 * Core aircraft data from OpenSky API
 */
export interface OpenSkyState {
  ICAO24: string;
  latitude?: number;
  longitude?: number;
  baro_altitude?: number;
  velocity?: number;
  true_track?: number;
  on_ground?: boolean;
  last_contact?: number;
  registration?: string;
  MANUFACTURER?: string;
  NAME?: string;
  CITY?: string;
  STATE?: string;
  COUNTRY?:string;
  TYPE_AIRCRAFT?: string;
  TYPE_REGISTRANT?: number;
  ownerType?: number;
  OPERATOR?: string;
  isTracked?: boolean;
}

export type OpenSkyStateArray = [
  ICAO24: string, // [0]
  callsign: string, // [1]
  COUNTRY: string, // [2]
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

export type PartialOpenSkyState = any[];

/**
 * Complete aircraft information including registration and tracking data
 */
export interface Aircraft {
  // Core identification
  ICAO24: string;
  REGISTRATION: string;
  N_NUMBER?: string;
  MANUFACTURER: string;
  MODEL?: string;
  OPERATOR?: string;

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
  TYPE_REGISTRANT: number;
  ownerType?: number;
  TYPE_AIRCRAFT: string;
  AIRCRAFT_TYPE?: string;
  COUNTRY?: string;

  // Tracking state
  isTracked: boolean;

  // Optional fields
  registration?: string;
  manufacturerName?: string;
  OWNER?: string;
  registered?: string;
  manufacturerIcao?: string;
  operatorIcao?: string;
  active?: boolean;
  marker?: string;
}

// lib/types/aircraft.ts

export interface AircraftRecord {
  id: number;
  REGISTRATION: string;
  ICAO24: string;
  MANUFACTURER: string;
  MODEL: string;
  OPERATOR: string | null;
  TYPE_REGISTRANT?: number;
  ownerType?: number;
  NAME: string | null;
  CITY: string | null;
  STATE: string | null;
  COUNTRY?: string;
  created_at: string; // or Date if you're parsing timestamps
  TYPE_AIRCRAFT: string | null;
}

/**
 * Position data from OpenSky API
 */
export interface PositionData {
  ICAO24: string;
  latitude: number;
  longitude: number;
  velocity?: number;
  heading?: number;
  altitude?: number;
  on_ground: boolean;
  last_contact: number;
  MODEL?: string;
  MANUFACTURER?: string;
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
  ICAO24: string;
  registration?: string;
  manufacturerName?: string;
  MODEL?: string;
  OPERATOR?: string;
  COUNTRY?: string;
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
  ICAO24: string;

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
  registration?: string;
  REGISTRATION?: string;
  MANUFACTURER?: string;
  MODEL?: string;
  NAME?: string;
  CITY?: string;
  STATE?: string;
  COUNTRY?: string;
  TYPE_AIRCRAFT?: string;
  TYPE_REGISTRANT?: number;
  ownerType?: number;
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
  ICAO24: string;
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

// src/types/MANUFACTURER.ts
/**
 * Manufacturer information
 */
export interface IManufacturer {
  value: string;
  label: string;
  activeCount?: number;
}

/**
 * Detailed MANUFACTURER data
 */
export interface ManufacturerData {
  id: number;
  name: string;
  country: string;
  count: number;
  activeCount?: number;
}

export interface Model {
  MODEL: string;
  MANUFACTURER: string;
  activeCount?: number;
  label?: string;
  count?: number;
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

// Base MODEL interface with common properties
export interface BaseModel {
  MODEL: string;
  MANUFACTURER: string;
  label: string;
}

// Static MODEL extends base with count
export interface StaticModel extends BaseModel {
  count: number;
}

// Active MODEL extends base with activeCount
export interface ActiveModel extends BaseModel {
  activeCount: number;
  totalCount: number;
  count?: number;
  CITY?: string;
  STATE?: string;
  COUNTRY?: string;
  ownerType?: number;
  REGISTRANT_TYPE?: number;
  name?: string;
}

// Props interface for ModelSelector component
export interface ModelSelectorProps {
  selectedModel: string;
  setSelectedModel: (MODEL: string) => void;
  models: StaticModel[];
  totalActive?: number;
  onModelSelect: (MODEL: string) => void;
}

export interface ExtendedAircraft extends Aircraft {
  type: string; // From DynamicMap
  isGovernment: boolean; // From DynamicMap
  zoomLevel?: number;
  // Add any additional OpenSky properties if needed
}
