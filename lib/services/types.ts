// lib/services/types.ts
import type { WebSocket } from 'ws';
import type { Aircraft } from '@/types/base';

export interface OpenSkyIntegrated {
    getAircraft(icao24List: string[]): Promise<Aircraft[]>;
    subscribe(callback: (data: Aircraft[]) => void): () => void;
    addClient(ws: WebSocket): void;
    removeClient(ws: WebSocket): void;
    cleanup(): void;
}

export interface AircraftWithInterpolation extends Aircraft {
    last_interpolated?: number;
}