// position-update-service.ts
import { WebSocketService, WebSocketConfig } from '@/lib/services/websocket/websocket-service';
import { errorHandler, ErrorType } from './error-handler';
import { PositionServiceFactory } from './position-service-factory';


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
    private wsService: WebSocketService;
    private positions: Map<string, Position> = new Map();
    private updateCallback: ((positions: Position[]) => void) | null = null;

    private constructor() {
        const config: WebSocketConfig = {
            url: 'wss://opensky-network.org/api/states/all/ws',
            reconnectAttempts: 3,
            reconnectDelay: 5000,
            authRequired: true
        };
        this.wsService = new WebSocketService(config);
    }

    public static getInstance(): PositionUpdateService {
        if (!PositionUpdateService.instance) {
            PositionUpdateService.instance = new PositionUpdateService();
        }
        return PositionUpdateService.instance;
    }

    private handleMessage(data: any): void {
        if (data && data.states) {
            this.processStates(data.states);
        }
    }

    private handleError(error: Error): void {
        errorHandler.handleError(ErrorType.WEBSOCKET, error.message);
    }

    private processStates(states: any[]): void {
        const currentTime = Math.floor(Date.now() / 1000);
        const updatedPositions: Position[] = [];

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
                updatedPositions.push(position);
            }
        });

        if (updatedPositions.length > 0 && this.updateCallback) {
            this.updateCallback(updatedPositions);
        }
    }

    public subscribe(callback: (positions: Position[]) => void): () => void {
        this.updateCallback = callback;
        
        if (this.positions.size > 0) {
            callback(Array.from(this.positions.values()));
        }

        return () => {
            this.updateCallback = null;
        };
    }

    public async start(): Promise<void> {
        if (!this.wsService.isActive()) {
            await this.wsService.connect(
                this.handleMessage.bind(this),
                this.handleError.bind(this)
            );
        }
    }

    public stop(): void {
        this.wsService.disconnect();
        this.positions.clear();
        this.updateCallback = null;
    }

    public isActive(): boolean {
        return this.wsService.isActive();
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