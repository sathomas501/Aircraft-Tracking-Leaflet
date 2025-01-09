// types/api/opensky.ts
import type { Aircraft } from '../base';

/**
 * Custom Error for OpenSky API
 */
export class OpenSkyError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'OpenSkyError';
  }
}

/**
 * Raw state vector array from OpenSky API
 */
export type OpenSkyStateVector = [
  string,               // icao24
  string | null,        // callsign
  string,              // origin_country
  number | null,       // time_position
  number,              // last_contact
  number | null,       // longitude
  number | null,       // latitude
  number | null,       // baro_altitude
  boolean,             // on_ground
  number | null,       // velocity
  number | null,       // true_track
  number | null,       // vertical_rate
  number[] | null,     // sensors
  number | null,       // geo_altitude
  string | null,       // squawk
  boolean,             // spi
  number               // position_source
];

export interface OpenSkyResponse {
  time: number;
  states: OpenSkyStateVector[];
}


export interface OpenSkyState {
  icao24: string;
  callsign: string | null;
  origin_country: string;
  time_position: number | null;
  last_contact: number;
  longitude: number | null;
  latitude: number | null;
  baro_altitude: number | null;
  on_ground: boolean;
  velocity: number | null;
  true_track: number | null;
  vertical_rate: number | null;
  sensors: number[] | null;
  geo_altitude: number | null;
  squawk: string | null;
  spi: boolean;
  position_source: number;
}




export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe';
  filters: {
    states: boolean;
    [key: string]: boolean;
  };
}

export interface OpenSkyStateMap {
  [icao24: string]: OpenSkyState;
}

// Utility functions
export const OpenSkyUtils = {
  vectorToState(vector: OpenSkyStateVector): OpenSkyState {
    const [
      icao24, callsign, origin_country, time_position, last_contact,
      longitude, latitude, baro_altitude, on_ground, velocity,
      true_track, vertical_rate, sensors, geo_altitude, squawk,
      spi, position_source
    ] = vector;

    return {
      icao24,
      callsign,
      origin_country,
      time_position,
      last_contact,
      longitude,
      latitude,
      baro_altitude,
      on_ground,
      velocity,
      true_track,
      vertical_rate,
      sensors,
      geo_altitude,
      squawk,
      spi,
      position_source
    };
  },

  stateToPosition(state: OpenSkyState): AircraftPosition | null {
    if (!state.latitude || !state.longitude) return null;

    return {
      lat: state.latitude,
      lng: state.longitude,
      altitude: state.baro_altitude ?? state.geo_altitude ?? undefined,
      heading: state.true_track ?? undefined,
      velocity: state.velocity ?? undefined,
      on_ground: state.on_ground
    };
  },

  hasValidPosition(state: OpenSkyState): boolean {
    return (
      typeof state.latitude === 'number' &&
      typeof state.longitude === 'number' &&
      !isNaN(state.latitude) &&
      !isNaN(state.longitude)
    );
  },

  responseToStateMap(response: OpenSkyResponse): OpenSkyStateMap {
    return response.states.reduce<OpenSkyStateMap>((acc, vector) => {
      const state = this.vectorToState(vector);
      if (this.hasValidPosition(state)) {
        acc[state.icao24] = state;
      }
      return acc;
    }, {});
  },

  mergeWithAircraft(state: OpenSkyState, aircraft: Partial<Aircraft>): Aircraft {
    return {
      icao24: state.icao24,
      latitude: state.latitude ?? 0,
      longitude: state.longitude ?? 0,
      altitude: state.baro_altitude ?? state.geo_altitude ?? 0,
      heading: state.true_track ?? 0,
      velocity: state.velocity ?? 0,
      on_ground: state.on_ground,
      last_contact: state.last_contact,
      "N-NUMBER": aircraft["N-NUMBER"] ?? "",
      manufacturer: aircraft.manufacturer ?? "",
      model: aircraft.model ?? "",
      operator: aircraft.operator ?? "",
      NAME: aircraft.NAME ?? "",
      CITY: aircraft.CITY ?? "",
      STATE: aircraft.STATE ?? "",
      isTracked: aircraft.isTracked ?? false
    };
  }
}

// types/api/opensky.ts
export interface AircraftPosition {
  lat: number;
  lng: number;
  altitude?: number;
  heading?: number;
  velocity?: number;
  on_ground?: boolean;
}

export interface PositionData {
  icao24: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  velocity?: number;
  heading?: number;
  on_ground?: boolean;
  last_contact?: number;
}

