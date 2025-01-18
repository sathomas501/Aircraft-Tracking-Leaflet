
//types/opensky.ts
import type { Aircraft, PositionData } from './base';

export interface OpenSkyAircraft {
    icao24: string;
    latitude?: number;
    longitude?: number;
    altitude?: number;
    velocity?: number;
    heading: number;
    on_ground: boolean;
    last_contact: number;
    manufacturer: string;
    model?: string;
}

export interface OpenSkyAircraft extends Omit<PositionData, 'latitude' | 'longitude'> {
    latitude?: number;
    longitude?: number;
    manufacturer: string;
    model?: string;
}

export interface ExtendedAircraft extends OpenSkyAircraft, Aircraft {
    altitude: number; // Explicitly define `altitude` as optional
    heading: number;
    latitude: number;
    longitude: number;
    velocity: number;
    "N-NUMBER": string;
    manufacturer: string;
    model?: string;
    NAME: string;
    CITY: string;
    STATE: string;
    isTracked: boolean;
}

export interface AircraftMessage {
    isTracked: boolean;
    icao24: string;
    latitude?: number;
    longitude?: number;
    altitude?: number;
    velocity?: number;
    heading?: number;
    onGround?: boolean;
    lastContact?: number;
    N_N?: string;
    manufacturer?: string;
    model?: string;
    NAME?: string;
    CITY?: string;
    STATE?: string;
}