
import type { WebSocketClient } from '@/types/websocket'
import type { IOpenSkyService } from '@/lib/services/opensky-integrated/types';
import type { PositionData } from '@/types/base';
import type { ExtendedAircraft  } from '@/types/opensky';

export class OpenSkyIntegratedService implements IOpenSkyService {
    private static instance: OpenSkyIntegratedService;
    private clients: Set<WebSocketClient> = new Set();
    private subscribers: Set<(data: ExtendedAircraft[]) => void> = new Set();
    private positions: Map<string, PositionData> = new Map();
    private authInitialized = false;
    private username: string | null = null;

    private constructor() {}

    public static getInstance(): OpenSkyIntegratedService {
        if (!OpenSkyIntegratedService.instance) {
            OpenSkyIntegratedService.instance = new OpenSkyIntegratedService();
        }
        return OpenSkyIntegratedService.instance;
    }

    public async getAircraft(icao24List: string[]): Promise<ExtendedAircraft[]> {
        console.log('[DEBUG] Fetching aircraft details for:', icao24List);
        return icao24List.map((icao24) => ({
            icao24,
            manufacturer: 'Unknown',
            model: 'Unknown',
            altitude: 30000,
            heading: 90,
            latitude: 52.0,
            longitude: 13.0,
            velocity: 500,
            vertical_rate: 0,
            squawk: null,
            spi: false,
            on_ground: false,
            last_contact: Date.now(),
            "N-NUMBER": 'N/A',
            NAME: 'Unknown',
            CITY: 'Unknown',
            STATE: 'Unknown',
            OWNER_TYPE:'Unknown',
            TYPE_AIRCRAFT: 'Unknown',
            isTracked: false,
        }));
    }

    public getAuthStatus(): { authenticated: boolean; username: string | null } {
        return { authenticated: this.authInitialized, username: this.username };
    }

    public addClient(client: WebSocketClient): void {
        this.clients.add(client);
        console.log('[DEBUG] Added WebSocket client:', client);
    }

    public removeClient(client: WebSocketClient): void {
        this.clients.delete(client);
        console.log('[DEBUG] Removed WebSocket client:', client);
    }

    public subscribe(callback: (data: ExtendedAircraft[]) => void): () => void {
        this.subscribers.add(callback);
        console.log('[DEBUG] Subscribed to aircraft updates');
        
        return () => {
            this.subscribers.delete(callback);
            console.log('[DEBUG] Unsubscribed from aircraft updates');
        };
    }

    public async getPositions(): Promise<PositionData[]> {
        console.log('[DEBUG] Fetching positions');
        return [];
    }

    public async cleanup(): Promise<void> {
        console.log('[DEBUG] Cleaning up resources in OpenSkyIntegratedService');
        this.clients.clear();
        this.subscribers.clear();
        this.positions.clear();
    }

    public async getPositionsMap(): Promise<Map<string, PositionData>> {
        console.log('[DEBUG] Returning the positions map');
        return this.positions;
    }
}
