import { PollingService } from './polling-service';
import { WebSocketService, WebSocketConfig } from './websocket/websocket-service';
import { startDnsCheck } from '@/utils/network';
import { RateLimiter } from './rate-limiter';
import { errorHandler, ErrorType } from './error-handler';

interface AircraftState {
    icao24: string;
    position: {
        latitude: number;
        longitude: number;
        altitude: number;
    } | null;
    lastUpdate: number;
}

interface TrackingState {
    activeManufacturer: string | null;
    icao24List: string[];
    connectionMode: 'websocket' | 'polling' | 'none';
    isNetworkAvailable: boolean;
    aircraftStates: Map<string, AircraftState>;
}

export class ManufacturerTrackingService {
    private state: TrackingState = {
        activeManufacturer: null,
        icao24List: [],
        connectionMode: 'none',
        isNetworkAvailable: true,
        aircraftStates: new Map()
    };
    private rateLimiter = new RateLimiter({ requestsPerMinute: 30, requestsPerDay: 1000 });
    private pollingService = new PollingService(this.rateLimiter);
    private wsService: WebSocketService;
    private readonly MAX_RECONNECT_ATTEMPTS = 3;

    constructor() {
        const wsConfig: WebSocketConfig = {
            url: 'wss://opensky-network.org/api/states/all/ws',
            reconnectAttempts: this.MAX_RECONNECT_ATTEMPTS,
            reconnectDelay: 5000,
            authRequired: true
        };
        this.wsService = new WebSocketService(wsConfig);

        startDnsCheck(60000, (isAvailable) => {
            const previousState = this.state.isNetworkAvailable;
            this.state.isNetworkAvailable = isAvailable;
            console.log(`[TrackingService] Network available: ${isAvailable}`);
            
            // Handle network state changes while tracking
            if (previousState !== isAvailable && this.state.connectionMode !== 'none') {
                this.handleNetworkStateChange(isAvailable);
            }
        });
    }

    private async handleNetworkStateChange(isAvailable: boolean): Promise<void> {
        if (!isAvailable && this.state.connectionMode === 'websocket') {
            console.log('[TrackingService] Network lost, switching to polling');
            this.wsService.disconnect();
            await this.startPollingMode();
        } else if (isAvailable && this.state.connectionMode === 'polling') {
            console.log('[TrackingService] Network restored, attempting WebSocket connection');
            try {
                await this.startWebSocketMode();
            } catch (error) {
                console.error('[TrackingService] Failed to restore WebSocket connection:', error);
                // Continue with polling
            }
        }
    }

    async startTracking(manufacturer: string, icao24List: string[]): Promise<void> {
        if (this.state.connectionMode !== 'none') {
            await this.stopTracking();
        }

        this.state.activeManufacturer = manufacturer;
        this.state.icao24List = icao24List;
        this.state.aircraftStates.clear();

        if (this.state.isNetworkAvailable) {
            try {
                await this.startWebSocketMode();
            } catch (error) {
                console.warn('[TrackingService] WebSocket connection failed, falling back to polling:', error);
                await this.startPollingMode();
            }
        } else {
            console.log('[TrackingService] Network unavailable, using polling mode');
            await this.startPollingMode();
        }
    }

    private async startWebSocketMode(): Promise<void> {
        try {
            await this.wsService.connect(
                this.handleWebSocketMessage,
                this.handleWebSocketError
            );
            this.state.connectionMode = 'websocket';
            console.log('[TrackingService] WebSocket connection established');
        } catch (error) {
            console.warn('[TrackingService] WebSocket connection failed, falling back to polling:', error);
            await this.startPollingMode();
        }
    }

    private async startPollingMode(): Promise<void> {
        try {
            await this.pollingService.startPolling(
                this.state.icao24List,
                this.handlePollingUpdate.bind(this)
            );
            this.state.connectionMode = 'polling';
            console.log('[TrackingService] Polling mode started');
        } catch (error) {
            // Changed to use WEBSOCKET type instead of POLLING
            errorHandler.handleError(ErrorType.WEBSOCKET, 'Failed to start polling');
            throw error;
        }
    }

    getTrackingStatus(): {
        isTracking: boolean;
        manufacturer: string | null;
        aircraftCount: number;
        activeAircraftCount: number;
        networkAvailable: boolean;
        connectionMode: TrackingState['connectionMode'];
        rateLimitInfo: {
            remainingRequests: number;
            remainingDaily: number;
        };
    } {
        const activeAircraft = Array.from(this.state.aircraftStates.values())
            .filter(state => Date.now() - state.lastUpdate < 300000).length; // 5 minutes threshold

        return {
            isTracking: this.state.connectionMode !== 'none',
            manufacturer: this.state.activeManufacturer,
            aircraftCount: this.state.icao24List.length,
            activeAircraftCount: activeAircraft,
            networkAvailable: this.state.isNetworkAvailable,
            connectionMode: this.state.connectionMode,
            rateLimitInfo: {
                remainingRequests: this.rateLimiter.getRemainingRequests(),
                remainingDaily: this.rateLimiter.getRemainingDailyRequests(),
            },
        };
    }

    private handleWebSocketMessage = (data: any) => {
        if (!data?.states) return;
        
        const timestamp = Date.now();
        data.states.forEach((state: any[]) => {
            if (state && state[0] && this.state.icao24List.includes(state[0])) {
                this.updateAircraftState(state[0], {
                    latitude: state[6],
                    longitude: state[5],
                    altitude: state[7]
                }, timestamp);
            }
        });
    };

    private handleWebSocketError = async (error: Error) => {
        console.error('[TrackingService] WebSocket error:', error);
        if (this.state.connectionMode === 'websocket') {
            try {
                await this.startPollingMode();
            } catch (fallbackError) {
                console.error('[TrackingService] Failed to start polling fallback:', fallbackError);
                // Changed to use WEBSOCKET type instead of CRITICAL
                errorHandler.handleError(ErrorType.WEBSOCKET, 'Both WebSocket and polling failed');
            }
        }
    };

    private handlePollingUpdate = (data: any): void => {
        if (!data?.states) return;
        
        const timestamp = Date.now();
        data.states.forEach((state: any[]) => {
            if (state && state[0] && this.state.icao24List.includes(state[0])) {
                this.updateAircraftState(state[0], {
                    latitude: state[6],
                    longitude: state[5],
                    altitude: state[7]
                }, timestamp);
            }
        });
    };

    private updateAircraftState(
        icao24: string,
        position: AircraftState['position'],
        timestamp: number
    ): void {
        this.state.aircraftStates.set(icao24, {
            icao24,
            position,
            lastUpdate: timestamp
        });
    }

    async stopTracking(): Promise<void> {
        if (this.state.connectionMode === 'websocket') {
            this.wsService.disconnect();
        } else if (this.state.connectionMode === 'polling') {
            this.pollingService.stopPolling();
        }
        
        this.state.connectionMode = 'none';
        this.state.activeManufacturer = null;
        this.state.icao24List = [];
        this.state.aircraftStates.clear();
    }
}

export const manufacturerTracking = new ManufacturerTrackingService();