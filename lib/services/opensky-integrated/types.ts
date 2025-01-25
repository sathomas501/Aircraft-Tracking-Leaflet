import type { Aircraft } from '@/types/base';
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

export interface ExtendedAircraft extends Aircraft {
    lastUpdate?: number; // Ensure the `lastUpdate` property is part of the interface
}

export function toAircraft(position: PositionData): ExtendedAircraft {
    return {
        icao24: position.icao24,
        "N-NUMBER": '',
        manufacturer: '',
        model: position.model || '',
        NAME: '',
        CITY: '',
        STATE: '',
        OWNER_TYPE: '',
        TYPE_AIRCRAFT: '',
        isTracked: true,
        latitude: position.latitude,
        longitude: position.longitude,
        altitude: position.altitude ?? 0,
        heading: position.heading ?? 0,
        velocity: position.velocity ?? 0,
        on_ground: position.on_ground,
        last_contact: position.last_contact,
        lastUpdate: Date.now(), // This property is

    };
}