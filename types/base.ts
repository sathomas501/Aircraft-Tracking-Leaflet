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
  // Position data
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
 * Raw position data from OpenSky API
 */
// Update PositionData to match Aircraft requirements
export interface PositionData {
  icao24: string;
  latitude?: number;
  longitude?: number;
  velocity?: number;
  heading?: number;
  altitude?: number;
  on_ground: boolean;  // Make required
  last_contact: number;  // Make required
}

/**
 * Select option for dropdowns and selectors
 */
// types/base.ts
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
  const currentTime = Math.floor(Date.now() / 1000);
  
  return positionData.map((data) => {
      // Ensure we have valid position data or defaults
      const validData: Required<PositionData> = {
          icao24: data.icao24,
          latitude: data.latitude ?? 0,
          longitude: data.longitude ?? 0,
          altitude: data.altitude ?? 0,
          heading: data.heading ?? 0,
          velocity: data.velocity ?? 0,
          on_ground: data.on_ground,      // Already required
          last_contact: data.last_contact // Already required
      };

      return {
          icao24: validData.icao24,
          "N-NUMBER": "",
          manufacturer: "Unknown",
          model: "Unknown",
          operator: "Unknown",
          latitude: validData.latitude,
          longitude: validData.longitude,
          altitude: validData.altitude,
          heading: validData.heading,
          velocity: validData.velocity,
          on_ground: validData.on_ground,
          last_contact: validData.last_contact,
          NAME: "",
          CITY: "",
          STATE: "",
          isTracked: true
      };
  });
}

// Helper function to create PositionData with required fields
export function createPositionData(
  icao24: string,
  partialData: Partial<Omit<PositionData, 'icao24' | 'on_ground' | 'last_contact'>>
): PositionData {
  const currentTime = Math.floor(Date.now() / 1000);
  
  return {
      icao24,
      on_ground: false,  // Default value
      last_contact: currentTime,  // Default value
      ...partialData
  };
}

// Helper function to validate position data
export function validatePositionData(data: Partial<PositionData>): data is PositionData {
  return (
      typeof data.icao24 === 'string' &&
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