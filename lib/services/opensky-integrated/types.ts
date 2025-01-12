// lib/services/opensky-integrated/types.ts
import type { WebSocket } from 'ws';
import type { Aircraft } from '@/types/base';

export interface OpenSkyIntegrated {
    getAircraft(icao24List: string[]): Promise<Aircraft[]>;
    subscribe(callback: (data: Aircraft[]) => void): () => void;
}

export interface OpenSkyService extends OpenSkyIntegrated {
    addClient(ws: WebSocket): void;
    removeClient(ws: WebSocket): void;
    cleanup(): void;
}

export interface WebSocketClient extends WebSocket {
    isAlive?: boolean;
    aircraftFilter?: string[];
}