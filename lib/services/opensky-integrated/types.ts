// lib/services/opensky-integrated/types.ts
import type { Aircraft } from '@/types/base';
import type { ExtendedAircraft } from '@/types/opensky';
import type { WebSocketClient } from '@/types/websocket';
import type { PositionData } from '@/types/base';

export interface IOpenSkyService {
    getAircraft(icao24List: string[]): Promise<ExtendedAircraft[]>;
    getAuthStatus(): { authenticated: boolean; username: string | null };
    subscribe(callback: (data: ExtendedAircraft[]) => void): () => void;
    addClient(ws: WebSocketClient): void;
    removeClient(ws: WebSocketClient): void;
    cleanup(): void;
    getPositions(manufacturer: string): Promise<PositionData[]>;
    getPositionsMap(): Promise<Map<string, PositionData>>; // Map version
}


export interface OpenSkyIntegrated {
    getAircraft(icao24List: string[]): Promise<Aircraft[]>;
    subscribe(callback: (data: Aircraft[]) => void): () => void;
}

export interface OpenSkyManager extends OpenSkyIntegrated {
    addClient(ws: WebSocketClient): void;
    removeClient(ws: WebSocketClient): void;
    cleanup(): void;
}