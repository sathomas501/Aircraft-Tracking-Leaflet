// lib/services/positionUpdateService.ts
import WebSocket from 'ws';
import { openSkyAuth } from './opensky-auth';
import { errorHandler, ErrorType } from './error-handler';

interface Position {
    icao24: string;
    latitude: number;
    longitude: number;
    altitude: number;
    velocity: number;
    heading: number;
    on_ground: boolean;
    last_contact: number;
}

export class PositionUpdateService {
    private static instance: PositionUpdateService;
    private ws: WebSocket | null = null;
    private positions: Map<string, Position> = new Map();
    private isConnected = false;
    private reconnectAttempts = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 3;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private updateCallback: ((positions: Position[]) => void) | null = null;
    
    private constructor() {}

    public static getInstance(): PositionUpdateService {
        if (!PositionUpdateService.instance) {
            PositionUpdateService.instance = new PositionUpdateService();
        }
        return PositionUpdateService.instance;
    }

    private async setupWebSocket(): Promise<void> {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        // Authenticate first
        console.log('[WebSocket] Authenticating with OpenSky...');
        const isAuthenticated = await openSkyAuth.authenticate();
        
        if (!isAuthenticated) {
            console.error('[WebSocket] Authentication failed');
            errorHandler.handleError(ErrorType.AUTH, 'Failed to authenticate with OpenSky');
            return;
        }

        console.log('[WebSocket] Authentication successful, establishing connection...');

        const wsUrl = 'wss://opensky-network.org/api/states/all/ws';
        const headers = openSkyAuth.getAuthHeaders();

        try {
            this.ws = new WebSocket(wsUrl, {
                headers,
                handshakeTimeout: 10000
            });

            this.ws.on('open', () => {
                console.log('[WebSocket] Connected successfully');
                this.isConnected = true;
                this.reconnectAttempts = 0;
            });

            this.ws.on('message', (data: WebSocket.Data) => {
                try {
                    const states = JSON.parse(data.toString());
                    if (states && states.states) {
                        this.processStates(states.states);
                    }
                } catch (error) {
                    console.error('[WebSocket] Error processing message:', error);
                }
            });

            this.ws.on('close', (code: number, reason: string) => {
                console.log('[WebSocket] Connection closed:', { code, reason });
                this.isConnected = false;
                
                if (code === 1006 || code === 1015) {
                    // Connection error or TLS handshake error
                    openSkyAuth.reset(); // Reset auth state
                }
                
                this.handleReconnect();
            });

            this.ws.on('error', (error) => {
                console.error('[WebSocket] Connection error:', error);
                this.isConnected = false;
                
                if (error.message.includes('403')) {
                    openSkyAuth.reset(); // Reset auth on forbidden
                }
                
                this.handleReconnect();
            });

        } catch (error) {
            console.error('[WebSocket] Setup error:', error);
            this.handleReconnect();
        }
    }

    private handleReconnect(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
            console.error('[WebSocket] Max reconnection attempts reached');
            errorHandler.handleError(
                ErrorType.WEBSOCKET, 
                'Failed to establish WebSocket connection after multiple attempts'
            );
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        
        console.log(`[WebSocket] Attempting to reconnect (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS}) in ${delay}ms`);
        
        this.reconnectTimeout = setTimeout(() => {
            this.setupWebSocket();
        }, delay);
    }

    private processStates(states: any[]): void {
        const currentTime = Math.floor(Date.now() / 1000);
        let updatedPositions = false;

        states.forEach(state => {
            if (state && state[0] && state[5] && state[6]) {
                const position: Position = {
                    icao24: state[0],
                    latitude: state[6],
                    longitude: state[5],
                    altitude: state[7] || 0,
                    velocity: state[9] || 0,
                    heading: state[10] || 0,
                    on_ground: state[8] || false,
                    last_contact: state[4] || currentTime
                };
                this.positions.set(position.icao24, position);
                updatedPositions = true;
            }
        });

        if (updatedPositions && this.updateCallback) {
            this.updateCallback(Array.from(this.positions.values()));
        }
    }

    public subscribe(callback: (positions: Position[]) => void): () => void {
        this.updateCallback = callback;
        
        // Send initial positions if we have any
        if (this.positions.size > 0) {
            callback(Array.from(this.positions.values()));
        }

        // Return unsubscribe function
        return () => {
            this.updateCallback = null;
        };
    }

    public async start(): Promise<void> {
        if (!this.isConnected) {
            await this.setupWebSocket();
        }
    }

    public stop(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.isConnected = false;
        this.positions.clear();
        this.updateCallback = null;
    }

    public isActive(): boolean {
        return this.isConnected;
    }

    public getCurrentPositions(): Position[] {
        return Array.from(this.positions.values());
    }

    public clearPositions(): void {
        this.positions.clear();
        if (this.updateCallback) {
            this.updateCallback([]);
        }
    }
}

export const positionUpdateService = PositionUpdateService.getInstance();