//types/opensky.ts
import {
  Aircraft,
  ExtendedAircraft as BaseExtendedAircraft,
  PositionData,
} from './base';

export interface OpenSkyAircraft {
  ICAO24: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  velocity?: number;
  heading: number;
  on_ground: boolean;
  last_contact: number;
  MANUFACTURER: string;
  MODEL?: string;
}

export interface OpenSkyAircraft
  extends Omit<PositionData, 'latitude' | 'longitude'> {
  latitude?: number;
  longitude?: number;
  MANUFACTURER: string;
  MODEL?: string;
}

export interface ExtendedAircraft extends OpenSkyAircraft, Aircraft {
  altitude: number; // Explicitly define `altitude` as optional
  heading: number;
  latitude: number;
  longitude: number;
  velocity: number;
  REGISTRATION: string;
  MANUFACTURER: string;
  MODEL?: string;
  NAME: string;
  CITY: string;
  STATE: string;
  isTracked: boolean;
}

export interface AircraftMessage {
  isTracked: boolean;
  ICAO24: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  velocity?: number;
  heading?: number;
  onGround?: boolean;
  lastContact?: number;
  N_N?: string;
  REGISTRATION?: number;
  MANUFACTURER?: string;
  MODEL?: string;
  TYPE_REGISTRANT?: number;
  TYPE_AIRCRAFT?: string;
  NAME?: string;
  CITY?: string;
  STATE?: string;
}

export interface OpenSkyPositionData {
  // Define the properties of the OpenSky position data
  ICAO24: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  velocity: number | null;
}
