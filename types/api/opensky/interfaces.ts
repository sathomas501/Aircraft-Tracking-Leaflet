// types/api/opensky/interfaces.ts
import type { Aircraft, PositionData, AircraftPosition as BaseAircraftPosition } from '../../base';
import { WebSocket } from 'ws';

export interface ActiveCounts {
  active: number;
  total: number;
}

export type PositionUpdateCallback = (positions: PositionData[]) => Promise<void>;
export type WebSocketClient = WebSocket;

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

export interface OpenSkyResponse {
  time: number;
  states: Array<Array<any>>;
}

export interface OpenSkyStateMap {
  [icao24: string]: OpenSkyState;
}