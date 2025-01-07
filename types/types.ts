export interface Aircraft {
  icao24: string;
  "N-NUMBER": string;
  manufacturer: string;
  model: string;
  operator: string;
  NAME: string;
  CITY: string;
  STATE: string;
  created_at?: string;
  latitude?: number;
  longitude?: number;
  velocity?: number;
  heading?: number;
  altitude?: number;
  on_ground?: boolean;
  last_contact?: number;
  isTracked: boolean;
}

export interface Position {
  lat: number;
  lng: number;
}

export interface SelectOption {
  value: string;
  label: string;
  count?: number;
}

// Add to existing types.ts
export interface SimpleMapProps {
  onAircraftCountChange?: (count: number) => void;
}

export interface AircraftPosition {
  lat: number;
  lng: number;
  altitude?: number;
  heading?: number;
  velocity?: number;
  on_ground?: boolean;
}

export interface AircraftMarker extends AircraftPosition {
  id: string;
  icao24: string;
  registration?: string;
  manufacturerName?: string;
  model?: string;
  operator?: string;
}

export interface Trails {
  [icao24: string]: Position[];
 }
 
 export interface PositionData {
  [icao24: string]: {
    latitude?: number;
    longitude?: number;
    velocity?: number;
    heading?: number;
    altitude?: number;
    on_ground?: boolean;
    last_contact?: number;
  };
 }