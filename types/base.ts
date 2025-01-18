// types/base.ts

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
  heading: number;   // Changed from optional to required
  altitude?: number;  // Changed from optional to required
  on_ground: boolean;
  last_contact: number;
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

  // Tracking state
  isTracked: boolean;
  
  registration?: string;
  manufacturerName?: string;
  owner?: string;
  registered?: string;
  manufacturerIcao?: string;
  operatorIcao?: string;
  active?: boolean;
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
    altitude: data.altitude ?? -1, // Replace `undefined` with a fallback value
    heading: data.heading,
    velocity: data.velocity ?? 0, // Replace `undefined` with a fallback value
    on_ground: data.on_ground,
    last_contact: data.last_contact,
    NAME: "",
    CITY: "",
    STATE: "",
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