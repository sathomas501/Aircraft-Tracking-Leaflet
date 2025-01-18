// lib/services/opensky-integrated.ts
import { enhancedCache } from '@/lib/services/managers/enhanced-cache';
import { openSkyAuth } from '../opensky-auth';
import { errorHandler, ErrorType } from '../error-handler';
import { positionInterpolator } from '@/utils/position-interpolation';
import type { Aircraft } from '@/types/base';
import type { PositionData } from '@/types/base';
import type { IOpenSkyService } from '@/lib/services/opensky-integrated/types';
import type { WebSocketClient } from '@/types/websocket';


function toAircraft(position: PositionData): Aircraft {
    return {
        ...position, // Spread properties from PositionData
        "N-NUMBER": '', // Default or actual value
        manufacturer: '', // Default or actual value
        model: '', // Default or actual value
        NAME: '', // Default or actual value
        CITY: '', // Default or actual value
        STATE: '', // Default or actual value
        isTracked: true, // Default or actual value
        altitude: position.altitude ?? 0, // Ensure altitude is a number
        heading:  position.heading ?? 0,
        velocity: position.velocity ?? 0,
    };
}


class OpenSkyIntegrated implements IOpenSkyService {
    // Class implementation here...

    private static instance: OpenSkyIntegrated;
    private ws: WebSocket | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private updateInterval: NodeJS.Timeout | null = null;
    private subscribers = new Set<(data: Aircraft[]) => void>();
    private clients: Set<WebSocketClient> = new Set(); // Add this line to define the clients property
    private readonly UPDATE_INTERVAL = 1000; // 1 second updates for interpolation
    private readonly WS_RECONNECT_DELAY = 5000; // 5 seconds
    private positions: Map<string, PositionData> = new Map();

    private constructor() {
        this.startUpdateLoop();
    }

    public async getPositionsMap(): Promise<Map<string, PositionData>> {
        return this.positions;
    }
    
    public async getPositions(): Promise<PositionData[]> {
        return Array.from(this.positions.values()); // Convert Map values to an array

    }

    getAuthStatus(): { authenticated: boolean; username: string | null } {
        const isAuthenticated = openSkyAuth.isAuthenticated();
        const username = isAuthenticated ? openSkyAuth.getUsername() : null;
        return { authenticated: isAuthenticated, username };
    }

    addClient(client: WebSocketClient): void {
        this.clients.add(client);
        console.log('Client added:', client);
    }

    removeClient(client: WebSocketClient): void {
        this.clients.delete(client);
        console.log('Client removed:', client);
    }

    static getInstance(): OpenSkyIntegrated {
        if (!OpenSkyIntegrated.instance) {
            OpenSkyIntegrated.instance = new OpenSkyIntegrated();
        }
        return OpenSkyIntegrated.instance;
    }

    private async initWebSocket() {
        if (this.ws) return;

        try {
            // Check authentication first
            const isAuthenticated = await openSkyAuth.authenticate();
            if (!isAuthenticated) {
                errorHandler.handleError(ErrorType.AUTH, 'OpenSky authentication failed');
                return;
            }

            const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
            const wsUrl = `${protocol}//${host}/api/opensky`;

            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                errorHandler.clearError(ErrorType.WEBSOCKET);
            };

            this.ws.onmessage = this.handleWebSocketMessage.bind(this);

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                errorHandler.handleError(ErrorType.WEBSOCKET, 'WebSocket connection error');
            };

            this.ws.onclose = () => {
                console.log('WebSocket closed');
                this.ws = null;
                this.scheduleReconnect();
            };

        } catch (error) {
            console.error('WebSocket initialization error:', error);
            errorHandler.handleError(ErrorType.WEBSOCKET, 'Failed to initialize WebSocket');
            this.scheduleReconnect();
        }
    }

    private handleWebSocketMessage(event: MessageEvent) {
        try {
            const data: PositionData[] = JSON.parse(event.data); // Assume WebSocket data matches PositionData[]
            const aircraftList: Aircraft[] = data.map(toAircraft); // Convert PositionData[] to Aircraft[]
    
            this.notifySubscribers(aircraftList); // Pass Aircraft[] to subscribers
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
        }
    }
    
    
    private scheduleReconnect() {
        if (this.reconnectTimeout) return;

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.initWebSocket();
        }, this.WS_RECONNECT_DELAY);
    }

    private startUpdateLoop() {
        if (this.updateInterval) return;
    
        this.updateInterval = setInterval(() => {
            const now = Date.now();
            const aircraftList: Aircraft[] = [];
    
            // Populate aircraftList from the cache with interpolation
            enhancedCache.getAllAircraft().forEach((aircraft) => {
                const interpolated = positionInterpolator.interpolatePosition(aircraft.icao24, now);
                if (interpolated) {
                    aircraftList.push({ ...aircraft, ...interpolated });
                } else {
                    aircraftList.push(aircraft);
                }
            });
    
            this.notifySubscribers(aircraftList); // Pass Aircraft[] to subscribers
        }, this.UPDATE_INTERVAL);
    }
    

    private notifySubscribers(data: Aircraft[]): void {
        this.subscribers.forEach((callback) => {
            try {
                callback(data); // Call each subscriber with Aircraft[]
            } catch (error) {
                console.error('Error in subscriber callback:', error);
            }
        });
    }
    
    async getAircraft(icao24List: string[]): Promise<Aircraft[]> {
        try {
            // Try WebSocket first
            if (!this.ws) {
                await this.initWebSocket();
            }

            // Get aircraft from cache with interpolation
            const results = await Promise.all(
                icao24List.map(async (icao24) => {
                    const aircraft = await enhancedCache.get(icao24);
                    if (aircraft) {
                        const interpolated = positionInterpolator.interpolatePosition(
                            icao24, 
                            Date.now()
                        );
                        return interpolated ? { ...aircraft, ...interpolated } : aircraft;
                    }
                    return null;
                })
            );

            return results.filter((aircraft): aircraft is Aircraft => aircraft !== null);

        } catch (error) {
            console.error('Error fetching aircraft:', error);
            errorHandler.handleError(ErrorType.DATA, 'Failed to fetch aircraft data');
            return [];
        }
    }


    
    subscribe(callback: (data: Aircraft[]) => void): () => void {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    cleanup() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.subscribers.clear();
    }
}

export const openSkyIntegrated = OpenSkyIntegrated.getInstance();