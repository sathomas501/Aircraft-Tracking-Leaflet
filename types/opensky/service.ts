// types/opensky/service.ts
import type { Aircraft, PositionData} from '../base';
import type { WebSocketClient } from '../websocket';

export interface OpenSkyState {
    authenticated: boolean;
    username: string | null;
    connected: boolean;
    lastUpdate: number;
}

export interface OpenSkyConfig {
    username?: string;
    password?: string;
    enableWebSocket?: boolean;
    syncInterval?: number;
    reconnectAttempts?: number;
    reconnectDelay?: number;
}

export type PositionUpdateCallback = (positions: PositionData[]) => Promise<void>;

export interface WebSocketMessage {
    type: 'positions' | 'filter' | 'status';
    data: Aircraft[] | string[] | { connected: boolean };
    manufacturer?: string | null;
}

export interface IOpenSkyService {
    getPositions(icao24List: string[]): Promise<PositionData[]>;
    subscribeToAircraft(icao24s: string[]): Promise<void>;
    unsubscribeFromAircraft(icao24s: string[]): void;
    addClient(client: WebSocketClient): void;
    removeClient(client: WebSocketClient): void;
    onPositionUpdate(callback: PositionUpdateCallback): void;
    removePositionUpdateCallback(callback: PositionUpdateCallback): void;
    getState(): OpenSkyState;
    cleanup(): void;
}

export interface ParsedPosition {
    icao24: string;
    latitude: number;
    longitude: number;
    altitude: number;
    velocity: number;
    heading: number;
    on_ground: boolean;
    last_contact: number;
}