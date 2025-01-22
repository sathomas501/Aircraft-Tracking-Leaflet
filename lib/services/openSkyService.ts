import { RateLimiter } from './rate-limiter';
import CacheManager from '@/lib/services/managers/cache-manager';
import { OPENSKY_API_CONFIG } from '@/lib/config/opensky';
import { wsAuth } from '@/lib/services/websocket/websocket-auth';
import { WebSocketHandler } from '@/lib/services/websocket/ws-handler';
import WebSocket from 'ws';
import { ExtendedAircraft } from '@/lib/services/opensky-integrated';
import { IOpenSkyService, PositionData, PositionUpdateCallback, OpenSkyState } from '@/types/opensky/index';
import type { WebSocketClient } from '@/types/websocket';

export class OpenSkyWebSocket implements IOpenSkyService {
    private socket: WebSocket | null = null;
    private wsHandler: WebSocketHandler;
    private cache: CacheManager<PositionData>;
    private rateLimiter: RateLimiter;
    private username: string | null = null;
    private positionCallbacks: Set<PositionUpdateCallback> = new Set();
    private lastUpdate: number = Date.now();

    constructor() {
        this.wsHandler = new WebSocketHandler(this);
        this.subscriptions = new Map();
        this.username = OPENSKY_API_CONFIG.AUTH.USERNAME;
        this.cache = new CacheManager<PositionData>(OPENSKY_API_CONFIG.CACHE.TTL.POSITION);
        this.rateLimiter = new RateLimiter({
            requestsPerMinute: OPENSKY_API_CONFIG.RATE_LIMITS.REQUESTS_PER_MINUTE,
            requestsPerDay: OPENSKY_API_CONFIG.RATE_LIMITS.REQUESTS_PER_DAY,
        });
    }

    async getAircraft(icao24List: string[]): Promise<ExtendedAircraft[]> {
        if (!(await this.rateLimiter.tryAcquire())) {
            throw new Error('Rate limit exceeded. Please wait before retrying.');
        }

        const headers = wsAuth.getAuthHeaders();
        const results: ExtendedAircraft[] = [];

        for (const icao24 of icao24List) {
            try {
                const response = await fetch(
                    `${OPENSKY_API_CONFIG.BASE_URL}/extended/${icao24}`,
                    { headers }
                );
                if (response.ok) {
                    const data = await response.json();
                    results.push(data);
                }
            } catch (error) {
                console.error('Error fetching aircraft:', error);
            }
        }

        return results;
    }

    getAuthStatus(): boolean {
        // Implementation
        return true;
    }

    connect(): void {
        // Implementation for WebSocket connection
    }

    private subscriptions: Map<string, (data: any) => void>;

    // Subscribe to a topic
    subscribe(topic: string, callback: (data: any) => void): void {
        console.log(`Subscribed to topic: ${topic}`);
        this.subscriptions.set(topic, callback);
    }

    // Unsubscribe from a topic
    unsubscribe(topic: string): void {
        if (this.subscriptions.has(topic)) {
            console.log(`Unsubscribed from topic: ${topic}`);
            this.subscriptions.delete(topic);
        } else {
            console.warn(`No subscription found for topic: ${topic}`);
        }
    }

    // Example method to trigger callbacks
    notifySubscribers(topic: string, data: any): void {
        const callback = this.subscriptions.get(topic);
        if (callback) {
            callback(data);
        }
    }

    async getPositions(icao24List?: string[]): Promise<PositionData[]> {
        if (!(await this.rateLimiter.tryAcquire())) {
            throw new Error('Rate limit exceeded. Please wait before retrying.');
        }

        const headers = wsAuth.getAuthHeaders();
        try {
            const url = icao24List?.length 
                ? `${OPENSKY_API_CONFIG.BASE_URL}/states/all?icao24=${icao24List.join(',')}`
                : `${OPENSKY_API_CONFIG.BASE_URL}/states/all`;

            const response = await fetch(url, { headers });
            if (!response.ok) return [];
            const data = await response.json();
            return this.parsePositionData(data.states);
        } catch (error) {
            console.error('Error fetching positions:', error);
            return [];
        }
    }

    async subscribeToAircraft(icao24s: string[]): Promise<void> {
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

    addClient(client: WebSocketClient): void {
        this.wsHandler.addClient(client);
    }

    removeClient(client: WebSocketClient): void {
        this.wsHandler.removeClient(client);
    }

    onPositionUpdate(callback: PositionUpdateCallback): void {
        this.positionCallbacks.add(callback);
    }

    removePositionUpdateCallback(callback: PositionUpdateCallback): void {
        this.positionCallbacks.delete(callback);
    }

    getState(): OpenSkyState {
        return {
            authenticated: wsAuth.isAuthenticated(),
            username: this.username,
            connected: this.socket?.readyState === WebSocket.OPEN,
            lastUpdate: this.lastUpdate
        };
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
            last_contact: state[4] || 0
        }));
    }

    private async notifyCallbacks(positions: PositionData[]): Promise<void> {
        for (const callback of this.positionCallbacks) {
            try {
                await callback(positions);
            } catch (error) {
                console.error('Error in position update callback:', error);
            }
        }
    }

    async cleanup(): Promise<void> {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.positionCallbacks.clear();
        this.cache.flush();
        await this.wsHandler.cleanup();
    }
}