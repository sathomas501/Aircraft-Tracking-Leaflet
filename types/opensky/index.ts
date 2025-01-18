// types/opensky/index.ts
import type { WebSocket } from 'ws';
import type { Aircraft } from '../base';
import type { ExtendedAircraft } from '@/types/opensky';
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

export interface PositionData {
    icao24: string;
    latitude: number;
    longitude: number;
    altitude: number;
    velocity: number;
    heading: number;
    on_ground: boolean;
    last_contact: number;
}

export type PositionUpdateCallback = (positions: PositionData[]) => Promise<void>;

export interface WebSocketMessage {
    type: 'positions' | 'filter' | 'status';
    data: Aircraft[] | string[] | { connected: boolean };
    manufacturer?: string | null;
}

export interface IOpenSkyService {
    // Core functionality
    getAircraft(icao24List: string[]): Promise<ExtendedAircraft[]>;
    getPositions(icao24List: string[]): Promise<PositionData[]>;
    subscribeToAircraft(icao24s: string[]): Promise<void>;
    unsubscribeFromAircraft(icao24s: string[]): void;
    getPositions(): Promise<PositionData[]>;
    
    // WebSocket management
    addClient(client: WebSocketClient): void;
    removeClient(client: WebSocketClient): void;
    
    // Event handling
    onPositionUpdate(callback: PositionUpdateCallback): void;
    removePositionUpdateCallback(callback: PositionUpdateCallback): void;
    
    // State management
    getState(): OpenSkyState;
    cleanup(): void;
}