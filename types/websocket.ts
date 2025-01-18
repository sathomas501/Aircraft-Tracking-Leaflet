// types/websocket.ts
import type { WebSocket } from 'ws';
import type { OpenSkyAircraft } from './opensky';

export interface WebSocketClient extends WebSocket {
    isAlive: boolean;
    aircraftFilter?: string[];
}

export interface WebSocketFilterMessage {
    type: 'filter';
    icao24s: string[];
}

export interface WebSocketPositionsMessage {
    type: 'positions';
    data: OpenSkyAircraft[];
    manufacturer?: string | null;
}

export interface WebSocketStatusMessage {
    type: 'status';
    connected: boolean;
}

export type WebSocketMessage = 
    | WebSocketFilterMessage 
    | WebSocketPositionsMessage 
    | WebSocketStatusMessage;

export interface WebSocketHandler {
    addClient(client: WebSocketClient): void;
    removeClient(client: WebSocketClient): void;
    broadcast(data: OpenSkyAircraft[]): void;
    cleanup(): void;
}

export interface WebSocketConfig {
    pingInterval?: number;    // Interval for ping checks in ms
    reconnectAttempts?: number;  // Maximum number of reconnection attempts
    reconnectDelay?: number;     // Base delay for reconnection in ms
}