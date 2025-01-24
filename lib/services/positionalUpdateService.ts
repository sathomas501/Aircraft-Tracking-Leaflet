import { errorHandler, ErrorType } from './error-handler';
import { PollingRateLimiter } from './rate-limiter';

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
    private positions: Map<string, Position> = new Map();
    private updateCallback: ((positions: Position[]) => void) | null = null;
    private pollingInterval: NodeJS.Timeout | null = null;
    private rateLimiter: PollingRateLimiter;

    private constructor() {
        this.rateLimiter = new PollingRateLimiter({
            requestsPerMinute: 60,
            requestsPerDay: 1000,
            minPollingInterval: 5000,
            maxPollingInterval: 30000
        });
    }

    public static getInstance(): PositionUpdateService {
        if (!PositionUpdateService.instance) {
            PositionUpdateService.instance = new PositionUpdateService();
        }
        return PositionUpdateService.instance;
    }

    private async fetchPositions(): Promise<void> {
        if (!await this.rateLimiter.tryAcquire()) {
            errorHandler.handleError(ErrorType.POLLING, 'Rate limit exceeded');
            return;
        }

        try {
            const response = await fetch('https://opensky-network.org/api/states/all', {
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.processStates(data.states || []);
            this.rateLimiter.decreasePollingInterval();

        } catch (error) {
            this.rateLimiter.increasePollingInterval();
            errorHandler.handleError(
                ErrorType.POLLING,
                error instanceof Error ? error.message : 'Failed to fetch positions'
            );
        }
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
            if (!this.updateCallback) {
                this.stop();
            }
        };
    }

    public async start(): Promise<void> {
        await this.fetchPositions();
        
        const interval = this.rateLimiter.getCurrentPollingInterval();
        this.pollingInterval = setInterval(async () => {
            await this.fetchPositions();
        }, interval);
    }

    public stop(): void {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        this.rateLimiter.resetPollingInterval();
    }

    public isActive(): boolean {
        return this.pollingInterval !== null;
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