// types/api/opensky.ts
import type { Aircraft } from '../base';
import { WebSocket } from 'ws';


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
export interface ActiveCounts {
  active: number;
  total: number;
}

export type PositionUpdateCallback = (positions: PositionData[]) => Promise<void>;
export type WebSocketClient = WebSocket;

export interface OpenSkyUtils {
  parseState(state: any[]): OpenSkyState;
  validateState(state: OpenSkyState): boolean;
}

export interface OpenSkyServiceInterface {
  getPositions(icao24s?: string[]): Promise<PositionData[]>;
  getActiveCount(manufacturer: string, model?: string): Promise<ActiveCounts>;
  clearActiveCache(manufacturer?: string, model?: string): void;
  cleanup(): void;
  onPositionUpdate(callback: PositionUpdateCallback): void;
  removePositionUpdateCallback(callback: PositionUpdateCallback): void;
  subscribeToAircraft(icao24s: string[]): Promise<void>;
  unsubscribeFromAircraft(icao24s: string[]): void;
  addClient(client: WebSocketClient): void;
  removeClient(client: WebSocketClient): void;
}
/**
 * Raw state data as received from OpenSky API
 */
export interface RawStateVector {
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

/**
 * Processed state data with undefined instead of null
 */
export interface OpenSkyState {
  icao24: string;
  callsign?: string;
  origin_country?: string;
  time_position?: number;
  last_contact?: number;
  longitude?: number;
  latitude?: number;
  baro_altitude?: number;
  on_ground?: boolean;
  velocity?: number;
  true_track?: number;
  vertical_rate?: number;
  sensors?: number[];
  geo_altitude?: number;
  squawk?: string;
  spi?: boolean;
  position_source?: number;
}

/**
 * Response from OpenSky API
 */
export interface OpenSkyResponse {
  time: number;
  states: Array<Array<any>>;
}

/**
 * Map of ICAO24 to state data
 */
export interface OpenSkyStateMap {
  [icao24: string]: OpenSkyState;
}

/**
 * Basic position data
 */
export interface AircraftPosition {
  lat: number;
  lng: number;
  altitude?: number;
  heading?: number;
  velocity?: number;
  on_ground?: boolean;
}

/**
 * Extended position data with identification
 */
export interface PositionData {
  icao24: string;
  latitude: number;      // Required
  longitude: number;     // Required
  altitude: number;      // Required, defaulted to 0 if undefined
  velocity: number;      // Required, defaulted to 0 if undefined
  heading: number;       // Required, defaulted to 0 if undefined
  on_ground: boolean;    // Required
  last_contact: number;  // Required
}

/**
 * WebSocket message types
 */

export interface WebSocketSubscribeMessage {
  type: 'subscribe';
  filters: {
      states: boolean;  // Required
      icao24: string[];
  };
}

export interface WebSocketPositionMessage {
  type: 'positions';
  data: PositionData[];
}

export interface WebSocketStatusMessage {
  type: 'connection_status';
  connected: boolean;
}

export interface WebSocketUnsubscribeMessage {
  type: 'unsubscribe';
  filters: {
      icao24: string[];
  };
}

export interface WebSocketConnectionStatusMessage {
  type: 'connection_status';
  connected: boolean;
}

export type WebSocketMessage = 
  | WebSocketSubscribeMessage 
  | WebSocketUnsubscribeMessage 
  | WebSocketConnectionStatusMessage;



export type WebSocketOutgoingMessage = WebSocketPositionMessage | WebSocketStatusMessage;

/**
 * Utility functions for OpenSky data handling
 */
export const OpenSkyUtils = {
  stateToPosition(state: OpenSkyState): AircraftPosition | null {
    if (!state.latitude || !state.longitude) return null;

    return {
      lat: state.latitude,
      lng: state.longitude,
      altitude: state.baro_altitude ?? state.geo_altitude,
      heading: state.true_track,
      velocity: state.velocity,
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

  mergeWithAircraft(state: OpenSkyState, aircraft: Partial<Aircraft>): Aircraft {
    const currentTime = Math.floor(Date.now() / 1000);
    return {
        icao24: state.icao24,
        latitude: state.latitude ?? 0,
        longitude: state.longitude ?? 0,
        altitude: state.baro_altitude ?? state.geo_altitude ?? 0,
        heading: state.true_track ?? 0,
        velocity: state.velocity ?? 0,
        on_ground: Boolean(state.on_ground),  // Ensure boolean
        last_contact: state.last_contact ?? currentTime,  // Ensure number
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
};

/**
 * Type guard functions
 */
export function isOpenSkyState(value: any): value is OpenSkyState {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.icao24 === 'string' &&
    typeof value.last_contact === 'number' &&
    typeof value.on_ground === 'boolean'
  );
}

export function isPositionData(value: any): value is PositionData {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.icao24 === 'string' &&
    typeof value.last_contact === 'number' &&
    typeof value.on_ground === 'boolean'
  );
}

// Type guard for PositionData
export function isValidPositionData(data: any): data is PositionData {
  return (
      data !== null &&
      typeof data.icao24 === 'string' &&
      typeof data.latitude === 'number' &&
      typeof data.longitude === 'number' &&
      typeof data.altitude === 'number' &&
      typeof data.velocity === 'number' &&
      typeof data.heading === 'number' &&
      typeof data.on_ground === 'boolean' &&
      typeof data.last_contact === 'number' &&
      !isNaN(data.latitude) &&
      !isNaN(data.longitude) &&
      !isNaN(data.altitude) &&
      !isNaN(data.velocity) &&
      !isNaN(data.heading) &&
      !isNaN(data.last_contact) &&
      data.latitude >= -90 &&
      data.latitude <= 90 &&
      data.longitude >= -180 &&
      data.longitude <= 180
  );
}


export interface ActiveCounts {
  active: number;
  total: number;
}

export interface IOpenSkyService {
  getPositions(icao24s?: string[]): Promise<PositionData[]>;
  getActiveCount(manufacturer: string, model?: string): Promise<ActiveCounts>;
  clearActiveCache(manufacturer?: string, model?: string): void;
  cleanup(): void;
  onPositionUpdate(callback: PositionUpdateCallback): void;
  removePositionUpdateCallback(callback: PositionUpdateCallback): void;
  subscribeToAircraft(icao24s: string[]): Promise<void>;
  unsubscribeFromAircraft(icao24s: string[]): void;
  addClient(client: WebSocketClient): void;
  removeClient(client: WebSocketClient): void;
}

// Helper function to parse position data safely
export function parsePositionData(rawData: any[]): PositionData | null {
  if (!Array.isArray(rawData) || rawData.length < 17) return null;

  const [
      icao24,
      _callsign,
      _origin_country,
      _time_position,
      last_contact,
      longitude,
      latitude,
      _baro_altitude,
      on_ground,
      velocity,
      heading,
      _vertical_rate,
      _sensors,
      altitude,
      _squawk,
      _spi,
      _position_source
  ] = rawData;

  // Ensure required fields are present and valid
  if (
      typeof icao24 !== 'string' ||
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      isNaN(latitude) ||
      isNaN(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
  ) {
      return null;
  }

  // Create position data with required fields
  const positionData: PositionData = {
    icao24,
    latitude,
    longitude,
    on_ground: Boolean(on_ground), // Convert to boolean
    last_contact: Math.floor(Number(last_contact) || Date.now() / 1000), // Ensure valid number
    altitude: typeof altitude === 'number' && !isNaN(altitude) ? altitude : 0,  // Default to 0
    velocity: typeof velocity === 'number' && !isNaN(velocity) ? velocity : 0,  // Default to 0
    heading: typeof heading === 'number' && !isNaN(heading) ? heading : 0,  // Default to 0
};

  return positionData;
}

export function parseOpenSkyStateToPosition(state: any[]): PositionData | null {
  if (!Array.isArray(state) || state.length < 17) return null;

  const [
      icao24,
      _callsign,
      _origin_country,
      _time_position,
      last_contact,
      longitude,
      latitude,
      _baro_altitude,
      on_ground,
      velocity,
      heading,
      _vertical_rate,
      _sensors,
      altitude,
      _squawk,
      _spi,
      _position_source
  ] = state;

  // Validate required coordinates first
  if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      isNaN(latitude) ||
      isNaN(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
  ) {
      return null;
  }

  // Create position with required fields and defaults
  const currentTime = Math.floor(Date.now() / 1000);
  
  return {
      icao24: String(icao24),
      latitude: latitude,
      longitude: longitude,
      altitude: typeof altitude === 'number' && !isNaN(altitude) ? altitude : 0,
      velocity: typeof velocity === 'number' && !isNaN(velocity) ? velocity : 0,
      heading: typeof heading === 'number' && !isNaN(heading) ? heading : 0,
      on_ground: Boolean(on_ground),
      last_contact: typeof last_contact === 'number' && !isNaN(last_contact) ? 
          Math.floor(last_contact) : currentTime
  };
}

export function positionDataToAircraft(data: PositionData): Aircraft {
  return {
      icao24: data.icao24,
      "N-NUMBER": "",
      manufacturer: "Unknown",
      model: "Unknown",
      operator: "Unknown",
      latitude: data.latitude,
      longitude: data.longitude,
      altitude: data.altitude,
      heading: data.heading,
      velocity: data.velocity,
      on_ground: data.on_ground,
      last_contact: data.last_contact,
      NAME: "",
      CITY: "",
      STATE: "",
      isTracked: true
  };
}

export function parseOpenSkyStates(rawStates: any[][]): PositionData[] {
  if (!Array.isArray(rawStates)) return [];

  return rawStates
      .map(state => parseOpenSkyStateToPosition(state))
      .filter((pos): pos is PositionData => pos !== null);
}