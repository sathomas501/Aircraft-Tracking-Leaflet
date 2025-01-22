import { PollingService } from './polling-service';
import { WebSocketService, WebSocketConfig } from './websocket/websocket-service';
import { startDnsCheck } from '@/utils/network';
import { RateLimiter } from './rate-limiter';

interface TrackingState {
    activeManufacturer: string | null;
    icao24List: string[];
    connectionMode: 'websocket' | 'polling' | 'none';
    isNetworkAvailable: boolean;
}

export class ManufacturerTrackingService {
    private state: TrackingState = {
        activeManufacturer: null,
        icao24List: [],
        connectionMode: 'none',
        isNetworkAvailable: true,
    };
    private rateLimiter = new RateLimiter({ requestsPerMinute: 30, requestsPerDay: 1000 });
    private pollingService = new PollingService(this.rateLimiter);
    private wsService: WebSocketService;

    constructor() {
        // Initialize WebSocketService with base config
        const wsConfig: WebSocketConfig = {
            url: 'wss://opensky-network.org/api/states/all/ws',  // This will be updated when starting tracking
            reconnectAttempts: 3,
            reconnectDelay: 5000,
            authRequired: true
        };
        this.wsService = new WebSocketService(wsConfig);

        startDnsCheck(60000, (isAvailable) => {
            this.state.isNetworkAvailable = isAvailable;
            console.log(`[TrackingService] Network available: ${isAvailable}`);
        });
    }

    async startTracking(manufacturer: string, icao24List: string[]): Promise<void> {
        this.state.activeManufacturer = manufacturer;
        this.state.icao24List = icao24List;

        if (this.state.isNetworkAvailable) {
            try {
                await this.wsService.connect(
                    this.handleWebSocketMessage,
                    this.handleWebSocketError
                );
                this.state.connectionMode = 'websocket';
            } catch (error) {
                console.error('[TrackingService] Failed to establish WebSocket connection:', error);
                // Fallback to polling
                this.pollingService.startPolling(
                    icao24List, 
                    this.handlePollingUpdate.bind(this)
                );
                this.state.connectionMode = 'polling';
            }
        } else {
            this.pollingService.startPolling(
                icao24List, 
                this.handlePollingUpdate.bind(this)
            );
            this.state.connectionMode = 'polling';
        }
    }

    getTrackingStatus(): {
        isTracking: boolean;
        manufacturer: string | null;
        aircraftCount: number;
        networkAvailable: boolean;
        connectionMode: TrackingState['connectionMode'];
        rateLimitInfo: {
            remainingRequests: number;
            remainingDaily: number;
        };
    } {
        return {
            isTracking: this.state.connectionMode !== 'none',
            manufacturer: this.state.activeManufacturer,
            aircraftCount: this.state.icao24List.length,
            networkAvailable: this.state.isNetworkAvailable,
            connectionMode: this.state.connectionMode,
            rateLimitInfo: {
                remainingRequests: this.rateLimiter.getRemainingRequests(),
                remainingDaily: this.rateLimiter.getRemainingDailyRequests(),
            },
        };
    }
    

    stopTracking(): void {
        if (this.state.connectionMode === 'websocket') {
            this.wsService.disconnect();
        } else if (this.state.connectionMode === 'polling') {
            this.pollingService.stopPolling();
        }
        this.state.connectionMode = 'none';
        this.state.activeManufacturer = null;
        this.state.icao24List = [];
    }

    private handleWebSocketMessage = (data: any) => {
        // Handle incoming WebSocket messages
        console.log('[TrackingService] WebSocket message received:', data);
        // Add your message handling logic here
    };

    private handleWebSocketError = (error: Error) => {
        console.error('[TrackingService] WebSocket error:', error);
        // Switch to polling if WebSocket fails
        if (this.state.connectionMode === 'websocket') {
            this.state.connectionMode = 'polling';
            this.pollingService.startPolling(
                this.state.icao24List, 
                this.handlePollingUpdate.bind(this)
            );
        }
    };

    private handlePollingUpdate(data: any): void {
        // Handle polling updates
        console.log('[TrackingService] Polling update received:', data);
        // Add your polling update handling logic here
    }
}
export const manufacturerTracking = new ManufacturerTrackingService();