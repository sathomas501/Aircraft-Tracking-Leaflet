// lib/services/opensky-integrated.ts
import { enhancedCache } from './enhanced-cache';
import { openSkyAuth } from './opensky-auth';
import { errorHandler, ErrorType } from './error-handler';
import { positionInterpolator } from '@/utils/position-interpolation';
import type { Aircraft } from '@/types/base';

class OpenSkyIntegrated {
    private static instance: OpenSkyIntegrated;
    private ws: WebSocket | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private updateInterval: NodeJS.Timeout | null = null;
    private subscribers = new Set<(data: Aircraft[]) => void>();

    private readonly UPDATE_INTERVAL = 1000; // 1 second updates for interpolation
    private readonly WS_RECONNECT_DELAY = 5000; // 5 seconds

    private constructor() {
        this.startUpdateLoop();
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
            const data = JSON.parse(event.data);
            if (Array.isArray(data)) {
                // Update cache and interpolator
                data.forEach(aircraft => {
                    enhancedCache.set(aircraft.icao24, aircraft);
                    positionInterpolator.updatePosition(aircraft);
                });

                // Notify subscribers
                this.notifySubscribers();
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
            errorHandler.handleError(ErrorType.DATA, 'Invalid data received');
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
            this.notifySubscribers();
        }, this.UPDATE_INTERVAL);
    }

    private notifySubscribers() {
        const now = Date.now();
        const aircraftList: Aircraft[] = [];

        // Get all cached aircraft
        enhancedCache.getAllAircraft().forEach(aircraft => {
            // Try to get interpolated position
            const interpolated = positionInterpolator.interpolatePosition(aircraft.icao24, now);
            if (interpolated) {
                aircraftList.push({
                    ...aircraft,
                    ...interpolated
                });
            } else {
                aircraftList.push(aircraft);
            }
        });

        // Notify subscribers
        this.subscribers.forEach(subscriber => {
            try {
                subscriber(aircraftList);
            } catch (error) {
                console.error('Error in subscriber:', error);
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