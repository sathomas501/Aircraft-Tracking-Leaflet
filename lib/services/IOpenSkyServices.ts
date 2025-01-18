// src/types/IOpenSkyService.ts
import WebSocket from 'ws';
import { PositionData} from '@/types/base';
import { ExtendedAircraft } from  '@/lib/services/opensky-integrated';

export interface IOpenSkyService {
    getAuthStatus(): { authenticated: boolean; username: string | null };
    addClient(client: WebSocket): void;
    removeClient(client: WebSocket): void;
    getAircraft(icao24List: string[]): Promise<ExtendedAircraft[]>;
    subscribe(callback: (data: ExtendedAircraft[]) => void): () => void;
    getPositions(): Promise<PositionData[]>;
    getPositionsMap(): Promise<Map<string, PositionData>>;
    cleanup(): Promise<void>;
}
