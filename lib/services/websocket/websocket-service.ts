// services/opensky-websocket.ts
import { CacheManager } from '@/lib/services/managers/cache-manager';
import { OPENSKY_API_CONFIG } from '@/lib/config/opensky';
import { openSkyAuth } from '@/lib/services/opensky-auth';
import { ExtendedAircraft } from '@/lib/services/opensky-integrated';
import { IOpenSkyService, PositionData, PositionUpdateCallback, OpenSkyState } from '@/types/opensky/index';
import { errorHandler, ErrorType } from '../error-handler';
import WebSocket from 'ws';

export class OpenSkyWebSocket implements IOpenSkyService {
    private socket: WebSocket | null = null;
    private cache: CacheManager<PositionData>;
    private positionCallbacks: Set<PositionUpdateCallback> = new Set();
    private username: string | null = null;
    private readonly RECONNECT_DELAY = 5000;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private lastUpdate: number = Date.now();

    constructor() {
        this.cache = new CacheManager<PositionData>(OPENSKY_API_CONFIG.CACHE.TTL.POSITION);
    }

    
    async getAircraft(icao24List: string[]): Promise<ExtendedAircraft[]> {
        try {
            const response = await fetch(
                `${OPENSKY_API_CONFIG.BASE_URL}/extended/${icao24List.join(',')}`,
                { headers: openSkyAuth.getAuthHeaders() }
            );
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            errorHandler.handleError(ErrorType.WEBSOCKET, 'Failed to fetch aircraft data');
            return [];
        }
    }

    async getPositions(icao24List?: string[]): Promise<PositionData[]> {
        try {
            const url = icao24List?.length 
                ? `${OPENSKY_API_CONFIG.BASE_URL}/states/all?icao24=${icao24List.join(',')}`
                : `${OPENSKY_API_CONFIG.BASE_URL}/states/all`;

            const response = await fetch(url, { 
                headers: openSkyAuth.getAuthHeaders() 
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return this.parsePositionData(data.states || []);
        } catch (error) {
            errorHandler.handleError(ErrorType.WEBSOCKET, 'Failed to fetch positions');
            return [];
        }
    }

    async subscribeToAircraft(icao24s: string[]): Promise<void> {
        this.connectWebSocket();
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ 
                type: 'subscribe', 
                data: { icao24s } 
            }));
        }
    }

    unsubscribeFromAircraft(icao24s: string[]): void {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ 
                type: 'unsubscribe', 
                data: { icao24s } 
            }));
        }
    }

    addClient(): void {
        // Implementation for WebSocket client management
    }

    removeClient(): void {
        // Implementation for WebSocket client management
    }

    private connectWebSocket(): void {
        if (this.socket) return;

        const wsUrl = `${OPENSKY_API_CONFIG.WS_URL}/states/all/ws`;
        this.socket = new WebSocket(wsUrl, {
            headers: openSkyAuth.getAuthHeaders()
        });

        this.socket.onopen = () => {
            console.log('WebSocket connected');
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = null;
            }
        };

        this.socket.onmessage = async (event) => {
            try {
                const data = JSON.parse(event.data.toString());
                const positions = this.parsePositionData(data.states || []);
                await this.notifyCallbacks(positions);
                this.lastUpdate = Date.now();
            } catch (error) {
                console.error('WebSocket message error:', error);
            }
        };

        this.socket.onerror = (error) => {
            errorHandler.handleError(ErrorType.WEBSOCKET, 'WebSocket connection error');
        };

        this.socket.onclose = () => {
            this.socket = null;
            this.scheduleReconnect();
        };
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimeout) return;
        
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connectWebSocket();
        }, this.RECONNECT_DELAY);
    }

    private parsePositionData(states: any[]): PositionData[] {
        return states.map(state => ({
            icao24: state[0],
            latitude: state[6] || 0,
            longitude: state[5] || 0,
            altitude: state[7] || 0,
            velocity: state[9] || 0,
            heading: state[10] || 0,
            on_ground: Boolean(state[8]),
            last_contact: state[4] || Date.now() / 1000
        }));
    }

    onPositionUpdate(callback: PositionUpdateCallback): void {
        this.positionCallbacks.add(callback);
    }

    removePositionUpdateCallback(callback: PositionUpdateCallback): void {
        this.positionCallbacks.delete(callback);
    }

    private async notifyCallbacks(positions: PositionData[]): Promise<void> {
        for (const callback of this.positionCallbacks) {
            try {
                await callback(positions);
            } catch (error) {
                console.error('Callback error:', error);
            }
        }
    }

    getState(): OpenSkyState {
        return {
            authenticated: openSkyAuth.isAuthenticated(),
            connected: this.socket?.readyState === WebSocket.OPEN,
            lastUpdate: this.lastUpdate,
            username: this.username
        };
    }

    async cleanup(): Promise<void> {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        this.positionCallbacks.clear();
        this.cache.flush();
    }
}

export default new OpenSkyWebSocket();