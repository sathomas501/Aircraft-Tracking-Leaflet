// types/types.ts

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
 * Complete aircraft information including registration and tracking data
 */
export interface Aircraft {
  // Core identification
  icao24: string;
  "N-NUMBER": string;
  manufacturer: string;
  model: string;
  operator: string;

  // Location and movement data
  latitude: number;
  longitude: number;
  altitude: number;
  heading: number;
  velocity: number;
  on_ground: boolean;
  last_contact: number;

  // Registration information
  NAME: string;
  CITY: string;
  STATE: string;

  // Tracking state
  isTracked: boolean;
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
 * Raw position data from OpenSky API
 */
export interface PositionData {
  icao24: string;
  latitude?: number;
  longitude?: number;
  velocity?: number;
  heading?: number;
  altitude?: number;
  on_ground?: boolean;
  last_contact?: number;
}

/**
 * Select option for dropdowns and selectors
 */
export interface SelectOption {
  value: string;
  label: string;
  count?: number;
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
export function positionDataToAircraftPosition(data: PositionData): AircraftPosition | null {
  if (!data.latitude || !data.longitude) return null;
  
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
    latitude: data.latitude ?? 0,
    longitude: data.longitude ?? 0,
    altitude: data.altitude ?? 0,
    heading: data.heading ?? 0,
    velocity: data.velocity ?? 0,
    on_ground: data.on_ground ?? false,
    last_contact: data.last_contact ?? Date.now(),
    NAME: "",
    CITY: "",
    STATE: "",
    isTracked: true,
  }));
}
