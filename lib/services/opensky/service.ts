// lib/services/opensky/service.ts
import type {PositionData } from '@/types/base';
import { positionToAircraft } from './utils';
import WebSocket from 'ws';
import { errorHandler, ErrorType } from '../error-handler';
import { unifiedCache } from '../managers/unified-cache-system';
import { positionInterpolator } from '@/utils/position-interpolation';
import type {
    IOpenSkyService,
    OpenSkyState,
    OpenSkyConfig,
    PositionUpdateCallback,
    WebSocketMessage,
} from '@/types/opensky/service';
import type { WebSocketClient } from '@/types/websocket'

export class OpenSkyManager implements IOpenSkyService {
    private static instance: OpenSkyManager;
    private ws: WebSocket | null = null;
    private clients: Set<WebSocketClient> = new Set();
    private positionCallbacks: Set<PositionUpdateCallback> = new Set();
    private subscribedIcao24s: Set<string> = new Set();
    private reconnectAttempts = 0;
    private syncInterval: NodeJS.Timeout | null = null;
    private pingInterval: NodeJS.Timeout | null = null;
    private state: OpenSkyState = {
        authenticated: false,
        username: null,
        connected: false,
        lastUpdate: 0
    };

    private constructor(private config: OpenSkyConfig = {}) {
        const defaultConfig: OpenSkyConfig = {
            enableWebSocket: true,
            syncInterval: 15000,
            reconnectAttempts: 5,
            reconnectDelay: 2000
        };
        this.config = { ...defaultConfig, ...config };
        
        if (this.config.enableWebSocket) {
            this.initializeWebSocket();
        }
        this.startPingInterval();
    }

    private initializeWebSocket(): void {
        if (this.ws?.readyState === WebSocket.OPEN) return;

        try {
            const wsUrl = this.constructWebSocketUrl();
            this.ws = new WebSocket(wsUrl);
            
            this.ws.on('open', this.handleWebSocketOpen.bind(this));
            this.ws.on('message', this.handleWebSocketMessage.bind(this));
            this.ws.on('error', this.handleWebSocketError.bind(this));
            this.ws.on('close', this.handleWebSocketClose.bind(this));
        } catch (error) {
            errorHandler.handleError(ErrorType.WEBSOCKET, 'Failed to initialize WebSocket');
        }
    }

    private constructWebSocketUrl(): string {
        const baseUrl = 'wss://opensky-network.org/api/websocket/opensky-feed';
        if (this.config.username && this.config.password) {
            const auth = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
            return `${baseUrl}?auth=${auth}`;
        }
        return baseUrl;
    }

    private startPingInterval(): void {
        if (this.pingInterval) clearInterval(this.pingInterval);
        
        this.pingInterval = setInterval(() => {
            this.clients.forEach(client => {
                if (client.isAlive === false) {
                    this.removeClient(client);
                    return;
                }
                client.isAlive = false;
                client.ping();
            });
        }, 30000);
    }

    private handleWebSocketOpen(): void {
        this.state.connected = true;
        this.broadcastStatus();
    }

    private handleWebSocketMessage(data: WebSocket.Data): void {
        try {
            const message = JSON.parse(data.toString());
            if (message.states) {
                const positions = this.parseOpenSkyStates(message.states);
                this.broadcastPositions(positions);
            }
        } catch (error) {
            errorHandler.handleError(ErrorType.DATA, 'Failed to process WebSocket message');
        }
    }

    private handleWebSocketError(error: Error): void {
        errorHandler.handleError(ErrorType.WEBSOCKET, error.message);
    }

    private handleWebSocketClose(): void {
        this.state.connected = false;
        this.scheduleReconnect();
    }

    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= (this.config.reconnectAttempts || 5)) return;
        
        this.reconnectAttempts++;
        const delay = (this.config.reconnectDelay || 2000) * Math.pow(2, this.reconnectAttempts - 1);
        setTimeout(() => this.initializeWebSocket(), delay);
    }

    private parseOpenSkyStates(states: any[][]): PositionData[] {
        const validPositions: PositionData[] = [];

        for (const state of states) {
            const [icao24, , , , lastContact, longitude, latitude, , onGround, velocity, heading, , , altitude] = state;
            
            if (!latitude || !longitude || isNaN(Number(latitude)) || isNaN(Number(longitude))) {
                continue;
            }

            validPositions.push({
                icao24: String(icao24),
                latitude: Number(latitude),
                longitude: Number(longitude),
                altitude: Number(altitude) || 0,
                velocity: Number(velocity) || 0,
                heading: Number(heading) || 0,
                on_ground: Boolean(onGround),
                last_contact: Number(lastContact) || Math.floor(Date.now() / 1000)
            });
        }

        return validPositions;
    }

    private broadcastPositions(positions: PositionData[]): void {
        positions.forEach(position => {
            const aircraft = positionToAircraft(position);
            unifiedCache.setAircraft(position.icao24, aircraft); // Use the new method
            positionInterpolator.updatePosition(aircraft);
        });
    
        this.positionCallbacks.forEach(callback => {
            callback(positions).catch(error => {
                console.error('Error in position callback:', error);
            });
        });
    }
    

    private broadcastStatus(): void {
        const message: WebSocketMessage = {
            type: 'status',
            data: { connected: this.state.connected }
        };
        this.broadcastToClients(message);
    }

    private broadcastToClients(message: WebSocketMessage): void {
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(JSON.stringify(message));
                } catch (error) {
                    console.error('Error sending to client:', error);
                    this.removeClient(client);
                }
            }
        });
    }

    // Update the getPositions method in OpenSkyService
    public async getPositions(icao24List?: string[]): Promise<PositionData[]> {
        try {
            // If no icao24List provided, use the subscribed ones
            const targetIcao24s = icao24List || Array.from(this.subscribedIcao24s);
            
            if (targetIcao24s.length === 0) {
                return [];
            }

            const response = await fetch('/api/opensky/positions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ icao24List: targetIcao24s })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Failed to fetch positions: ${error}`);
            }

            return await response.json();
        } catch (error) {
            errorHandler.handleError(ErrorType.NETWORK, 'Failed to fetch positions');
            throw error;
        }
    }

    public async getPositionsMap(): Promise<Map<string, PositionData>> {
        const positions = await this.getPositions();
        return new Map(positions.map(pos => [pos.icao24, pos]));
    }

 // Singleton instance getter
 public static getInstance(config: OpenSkyConfig = {
    username: process.env.OPENSKY_USERNAME || 'defaultUsername',
    password: process.env.OPENSKY_PASSWORD || 'defaultPassword',
    enableWebSocket: true,
    syncInterval: 15000,
    reconnectAttempts: 5,
    reconnectDelay: 2000,
}): OpenSkyManager {
    if (!OpenSkyManager.instance) {
        OpenSkyManager.instance = new OpenSkyManager(config);
    }
    return OpenSkyManager.instance;
}


    public async subscribeToAircraft(icao24s: string[]): Promise<void> {
        icao24s.forEach(icao24 => this.subscribedIcao24s.add(icao24));
        if (this.ws?.readyState === WebSocket.OPEN) {
            const message = {
                cmd: 'subscribe',
                filters: { icao24: Array.from(this.subscribedIcao24s) }
            };
            this.ws.send(JSON.stringify(message));
        }
    }

    public unsubscribeFromAircraft(icao24s: string[]): void {
        icao24s.forEach(icao24 => this.subscribedIcao24s.delete(icao24));
        if (this.ws?.readyState === WebSocket.OPEN) {
            const message = {
                cmd: 'unsubscribe',
                filters: { icao24: icao24s }
            };
            this.ws.send(JSON.stringify(message));
        }
    }

    public addClient(client: WebSocketClient): void {
        client.isAlive = true;
        this.clients.add(client);
    }

    public removeClient(client: WebSocketClient): void {
        this.clients.delete(client);
        try {
            client.terminate();
        } catch (error) {
            console.error('Error terminating client:', error);
        }
    }

    public onPositionUpdate(callback: PositionUpdateCallback): void {
        this.positionCallbacks.add(callback);
    }

    public removePositionUpdateCallback(callback: PositionUpdateCallback): void {
        this.positionCallbacks.delete(callback);
    }

    public getState(): OpenSkyState {
        return { ...this.state };
    }

    public cleanup(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }

        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }

        this.clients.forEach(client => this.removeClient(client));
        this.clients.clear();
        this.positionCallbacks.clear();
        this.subscribedIcao24s.clear();
    }
}

export const openSkyService = OpenSkyManager.getInstance({
    username: process.env.OPENSKY_USERNAME,
    password: process.env.OPENSKY_PASSWORD,
    enableWebSocket: true
});

const defaultConfig: OpenSkyConfig = {
    // Add your default config here
};

export const openSkyManager = OpenSkyManager.getInstance(defaultConfig);

// Also export the class itself
export default OpenSkyManager;