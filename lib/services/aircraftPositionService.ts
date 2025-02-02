import { errorHandler, ErrorType } from "./error-handler";
import { PollingRateLimiter } from './rate-limiter';
import { extrapolatePosition } from './extrapolation';

export interface Position {
    icao24: string;
    latitude: number;
    longitude: number;
    altitude: number;
    velocity: number;
    heading: number;
    on_ground: boolean;
    last_contact: number;
}

export class AircraftPositionService {
    private static instance: AircraftPositionService;
    private positions: Map<string, Position> = new Map();
    private positionHistory: Map<string, Position[]> = new Map();
    private positionExpiryTime = 5 * 60 * 1000; // 5 minutes
    private maxHistoryLength = 10; // Keep last 10 positions for trails
    private cleanupInterval: NodeJS.Timeout | null = null;
    private rateLimiter: PollingRateLimiter;

    private constructor() {
        this.rateLimiter = new PollingRateLimiter({
            requestsPerMinute: 60,
            requestsPerDay: 1000,
            minPollingInterval: 5000,
            maxPollingInterval: 30000
        });
        this.startCleanupRoutine();
    }

    public static getInstance(): AircraftPositionService {
        if (!AircraftPositionService.instance) {
            AircraftPositionService.instance = new AircraftPositionService();
        }
        return AircraftPositionService.instance;
    }

    private shouldUpdatePosition(currentPos: Position, newPos: Position): boolean {
        const minUpdateDistance = 10; // meters
        const minUpdateTime = 1000; // milliseconds

        // Time-based update
        if (newPos.last_contact - currentPos.last_contact > minUpdateTime) {
            return true;
        }

        // Distance-based update
        const R = 6371e3; // Earth's radius in meters
        const φ1 = currentPos.latitude * Math.PI/180;
        const φ2 = newPos.latitude * Math.PI/180;
        const Δφ = (newPos.latitude - currentPos.latitude) * Math.PI/180;
        const Δλ = (newPos.longitude - currentPos.longitude) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;

        return distance > minUpdateDistance;
    }

    public hasPosition(icao24: string): boolean {
        const position = this.positions.get(icao24);
        if (!position) return false;

        const now = Date.now();
        return now - position.last_contact < this.positionExpiryTime;
    }

    public getPosition(icao24: string): Position | null {
        return this.hasPosition(icao24) ? this.positions.get(icao24) || null : null;
    }

    public getPositionHistory(icao24: string): Position[] {
        return this.positionHistory.get(icao24) || [];
    }

    public updatePosition(position: Position): void {
        const currentPos = this.positions.get(position.icao24);
        const now = Date.now();

        if (currentPos) {
            // If we have a current position, check if we should update
            if (this.shouldUpdatePosition(currentPos, position)) {
                this.positions.set(position.icao24, position);

                // Update history
                const history = this.positionHistory.get(position.icao24) || [];
                this.positionHistory.set(position.icao24, [...history, position].slice(-this.maxHistoryLength));
            } else {
                // Use extrapolation
                const extrapolated = extrapolatePosition(currentPos, now);
                if (extrapolated) {
                    this.positions.set(position.icao24, extrapolated);
                }
            }
        } else {
            // First position update for this aircraft
            this.positions.set(position.icao24, position);
            this.positionHistory.set(position.icao24, [position]);
        }

        console.log(`[AircraftPositionService] Updated position for ${position.icao24}`);
    }

    public async pollAircraftData(fetchLiveData: (icao24s: string[]) => Promise<void>, icao24List: string[]): Promise<void> {
        if (!icao24List.length) return;

        const missingIcao24s = icao24List.filter(icao24 => !this.hasPosition(icao24));
        if (!missingIcao24s.length) {
            console.log('[AircraftPositionService] All requested aircraft positions are fresh.');
            return;
        }

        try {
            await this.rateLimiter.schedule(async () => {
                console.log(`[AircraftPositionService] Fetching data for ${missingIcao24s.length} aircraft.`);
                await fetchLiveData(missingIcao24s);
            });
        } catch (error) {
            errorHandler.handleError(ErrorType.POLLING, 'Failed to poll aircraft data', {
                icao24List: missingIcao24s,
                error
            });
        }
    }

    private cleanupPositions(): void {
        const now = Date.now();
        this.positions.forEach((position, icao24) => {
            if (now - position.last_contact >= this.positionExpiryTime) {
                this.positions.delete(icao24);
                console.log(`[AircraftPositionService] Removed stale position for ${icao24}`);
            }
        });
    }

    private startCleanupRoutine(): void {
        if (!this.cleanupInterval) {
            this.cleanupInterval = setInterval(() => {
                this.cleanupPositions();
            }, this.positionExpiryTime);
        }
    }

    public stopCleanupRoutine(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}