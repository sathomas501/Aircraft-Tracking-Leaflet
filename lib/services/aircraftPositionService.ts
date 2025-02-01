import { errorHandler, ErrorType } from "./error-handler";
import { PollingRateLimiter } from './rate-limiter';

export interface Position {
    icao24: string;
    latitude: number;
    longitude: number;
    altitude: number;
    velocity: number;
    heading: number;
    on_ground: boolean;
    last_contact: number;  // Timestamp of last update
    }


export class AircraftPositionService {
    private static instance: AircraftPositionService;
    private positions: Map<string, Position> = new Map();
    private positionExpiryTime = 5 * 60 * 1000; // 5 minutes before data is considered stale
    private cleanupInterval: NodeJS.Timeout | null = null;
    private rateLimiter: PollingRateLimiter;

    private constructor() {
        this.rateLimiter = new PollingRateLimiter({
            requestsPerMinute: 60,
            requestsPerDay: 1000,
            minPollingInterval: 5000,  // Minimum time between polls (5s)
            maxPollingInterval: 30000  // Maximum polling interval (30s)
        });
        this.startCleanupRoutine();
    }


    public static getInstance(): AircraftPositionService {
        if (!AircraftPositionService.instance) {
            AircraftPositionService.instance = new AircraftPositionService();
        }
        return AircraftPositionService.instance;
    }

    /**
     * Checks if a position exists in the cache and is still fresh.
     */
    public hasPosition(icao24: string): boolean {
        const position = this.positions.get(icao24);
        if (!position) return false;

        const now = Date.now();
        return now - position.last_contact < this.positionExpiryTime;
    }

    /**
     * Retrieves a cached position if available.
     */
    public getPosition(icao24: string): Position | null {
        return this.hasPosition(icao24) ? this.positions.get(icao24) || null : null;
    }

    /**
     * Updates or adds a position in the cache.
     */
    public updatePosition(position: Position): void {
        this.positions.set(position.icao24, position);
        console.log(`[AircraftPositionService] Updated position for ${position.icao24}`);
    }

    /**
     * Handles polling for live aircraft data while respecting rate limits.
     */
    public async pollAircraftData(fetchLiveData: (icao24s: string[]) => Promise<void>, icao24List: string[]): Promise<void> {
        if (!icao24List.length) return;

        // Filter out aircraft that already have a fresh position
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
    /**
     * Removes stale positions from the cache to free memory.
     */
    private cleanupPositions(): void {
        const now = Date.now();
        this.positions.forEach((position, icao24) => {
            if (now - position.last_contact >= this.positionExpiryTime) {
                this.positions.delete(icao24);
                console.log(`[AircraftPositionService] Removed stale position for ${icao24}`);
            }
        });
    }

    /**
     * Starts a cleanup routine to remove stale positions periodically.
     */
    private startCleanupRoutine(): void {
        if (!this.cleanupInterval) {
            this.cleanupInterval = setInterval(() => {
                this.cleanupPositions();
            }, this.positionExpiryTime);
        }
    }

    /**
     * Stops the cleanup routine when the service is no longer needed.
     */
    public stopCleanupRoutine(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}
