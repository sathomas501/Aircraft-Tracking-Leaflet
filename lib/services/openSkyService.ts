import axios from 'axios';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { errorHandler, ErrorType } from './error-handler';
import type { PositionData } from '@/types/base';

const OPENSKY_BASE_URL = 'https://opensky-network.org/api';
const OPENSKY_WS_URL = 'wss://opensky-network.org/api/websocket';
const OPENSKY_USERNAME = process.env.OPENSKY_USERNAME;
const OPENSKY_PASSWORD = process.env.OPENSKY_PASSWORD;

export class OpenSkyManager extends EventEmitter {
    private static instance: OpenSkyManager;
    private lastRequestTime: number = 0;
    private readonly MIN_REQUEST_INTERVAL = 5000; // 5 seconds between requests
    private clients: Set<WebSocket> = new Set();
    private ws: WebSocket | null = null;
    private wsReconnectTimeout: NodeJS.Timeout | null = null;
    private wsHeartbeatInterval: NodeJS.Timeout | null = null;
    private activeSubscriptions: Set<string> = new Set();

    private constructor() {
        super();
    }

    public static getInstance(): OpenSkyManager {
        if (!OpenSkyManager.instance) {
            OpenSkyManager.instance = new OpenSkyManager();
        }
        return OpenSkyManager.instance;
    }

    private getAuthHeaders() {
        if (OPENSKY_USERNAME && OPENSKY_PASSWORD) {
            const auth = Buffer.from(`${OPENSKY_USERNAME}:${OPENSKY_PASSWORD}`).toString('base64');
            return { Authorization: `Basic ${auth}` };
        }
        return {};
    }

    private async enforceRateLimit(): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
            await new Promise((resolve) =>
                setTimeout(resolve, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest)
            );
        }
        this.lastRequestTime = Date.now();
    }

    // WebSocket Client Management
    public addClient(client: WebSocket): void {
        this.clients.add(client);
        client.on('close', () => this.removeClient(client));
        
        // If this is our first client, initialize WebSocket connection
        if (this.clients.size === 1) {
            this.initializeWebSocket();
        }
    }

    public removeClient(client: WebSocket): void {
        this.clients.delete(client);
        
        // If no more clients, clean up WebSocket connection
        if (this.clients.size === 0) {
            this.cleanup();
        }
    }

    private async initializeWebSocket(): Promise<void> {
        if (this.ws) return;

        try {
            this.ws = new WebSocket(OPENSKY_WS_URL);

            this.ws.on('open', () => {
                console.log('[OpenSky WS] Connected');
                this.setupHeartbeat();
                this.authenticate();
            });

            this.ws.on('message', (data: WebSocket.Data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleWebSocketMessage(message);
                } catch (error) {
                    console.error('[OpenSky WS] Error parsing message:', error);
                }
            });

            this.ws.on('close', () => {
                console.log('[OpenSky WS] Connection closed');
                this.handleWebSocketDisconnect();
            });

            this.ws.on('error', (error) => {
                console.error('[OpenSky WS] Error:', error);
                this.handleWebSocketDisconnect();
            });

        } catch (error) {
            console.error('[OpenSky WS] Failed to initialize:', error);
            this.handleWebSocketDisconnect();
        }
    }

    private setupHeartbeat(): void {
        if (this.wsHeartbeatInterval) {
            clearInterval(this.wsHeartbeatInterval);
        }

        this.wsHeartbeatInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000);
    }

    private authenticate(): void {
        if (!this.ws || !OPENSKY_USERNAME || !OPENSKY_PASSWORD) return;

        const auth = Buffer.from(`${OPENSKY_USERNAME}:${OPENSKY_PASSWORD}`).toString('base64');
        this.ws.send(JSON.stringify({
            type: 'auth',
            data: { auth }
        }));
    }

    private handleWebSocketMessage(message: any): void {
        // Broadcast to all connected clients
        const messageStr = JSON.stringify(message);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(messageStr);
            }
        });

        // Emit events for hook consumption
        this.emit('stateVector', message);
    }

    private handleWebSocketDisconnect(): void {
        if (this.wsHeartbeatInterval) {
            clearInterval(this.wsHeartbeatInterval);
            this.wsHeartbeatInterval = null;
        }

        if (this.ws) {
            this.ws.removeAllListeners();
            this.ws = null;
        }

        // Attempt to reconnect after delay
        if (this.wsReconnectTimeout) {
            clearTimeout(this.wsReconnectTimeout);
        }

        this.wsReconnectTimeout = setTimeout(() => {
            if (this.clients.size > 0) {
                this.initializeWebSocket();
            }
        }, 5000);
    }

    public async fetchPositions(icao24List: string[]): Promise<PositionData[]> {
        await this.enforceRateLimit();

        if (!icao24List.length) {
            console.log('No ICAO24s provided');
            return [];
        }

        console.log(`[DEBUG] Fetching positions for ${icao24List.length} aircraft`);

        try {
            const url = new URL(`${OPENSKY_BASE_URL}/states/all`);
            url.searchParams.append('icao24', icao24List.join(','));

            const response = await axios.get(url.toString(), {
                headers: this.getAuthHeaders(),
                timeout: 10000,
            });

            if (response.data && Array.isArray(response.data.states)) {
                console.log(`[DEBUG] Found ${response.data.states.length} active aircraft positions`);
                return response.data.states;
            }

            return [];
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 429) {
                    errorHandler.handleError(ErrorType.RATE_LIMIT, 'OpenSky rate limit exceeded');
                } else if (error.response?.status === 403) {
                    errorHandler.handleError(ErrorType.AUTH, 'OpenSky authentication failed');
                } else if (error.code === 'ECONNABORTED') {
                    errorHandler.handleError(ErrorType.NETWORK, 'OpenSky request timeout');
                } else {
                    errorHandler.handleError(ErrorType.NETWORK, `OpenSky request failed: ${error.message}`);
                }
            } else {
                errorHandler.handleError(
                    ErrorType.DATA,
                    'Failed to fetch positions from OpenSky',
                    error instanceof Error ? error : new Error('Unknown error')
                );
            }
            console.error('[ERROR] Failed to fetch positions:', error);
            throw error;
        }
    }

    public cleanup(): void {
        if (this.wsHeartbeatInterval) {
            clearInterval(this.wsHeartbeatInterval);
            this.wsHeartbeatInterval = null;
        }

        if (this.wsReconnectTimeout) {
            clearTimeout(this.wsReconnectTimeout);
            this.wsReconnectTimeout = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.clients.clear();
        this.activeSubscriptions.clear();
    }
}

export const openSkyManager = OpenSkyManager.getInstance();