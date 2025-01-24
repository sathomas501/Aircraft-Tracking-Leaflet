import { unifiedCache } from '../managers/unified-cache-system';
import { openSkyAuth } from '../opensky-auth';
import { errorHandler, ErrorType } from '../error-handler';
import { positionInterpolator } from '@/utils/position-interpolation';
import { PollingRateLimiter } from '../rate-limiter';
import type { Aircraft, PositionData } from '@/types/base';
import type { IOpenSkyService } from './types';

interface ExtendedAircraft extends Aircraft {
    lastUpdate?: number;
}

function toAircraft(position: PositionData): ExtendedAircraft {
    return {
        icao24: position.icao24,
        "N-NUMBER": '',
        manufacturer: '',
        model: position.model || '',
        NAME: '',
        CITY: '',
        STATE: '',
        OWNER_TYPE: '',
        TYPE_AIRCRAFT: '',
        isTracked: true,
        latitude: position.latitude,
        longitude: position.longitude,
        altitude: position.altitude ?? 0,
        heading: position.heading ?? 0,
        velocity: position.velocity ?? 0,
        on_ground: position.on_ground,
        last_contact: position.last_contact,
        lastUpdate: Date.now()
    };
}


export class OpenSkyIntegrated implements IOpenSkyService {
    private static instance: OpenSkyIntegrated;
    private updateInterval: NodeJS.Timeout | null = null;
    private pollingInterval: NodeJS.Timeout | null = null;
    private subscribers = new Set<(data: ExtendedAircraft[]) => void>();
    private rateLimiter: PollingRateLimiter;
    private readonly UPDATE_INTERVAL = 1000;
    private positions: Map<string, PositionData> = new Map();

    private constructor() {
        this.rateLimiter = new PollingRateLimiter({
            requestsPerMinute: 60,
            requestsPerDay: 1000,
            minPollingInterval: 5000,
            maxPollingInterval: 30000
        });
        this.startUpdateLoop();
    }

    static getInstance(): OpenSkyIntegrated {
        if (!OpenSkyIntegrated.instance) {
            OpenSkyIntegrated.instance = new OpenSkyIntegrated();
        }
        return OpenSkyIntegrated.instance;
    }

    getAuthStatus(): { authenticated: boolean; username: string | null } {
        return {
            authenticated: openSkyAuth.isAuthenticated(),
            username: openSkyAuth.isAuthenticated() ? 'user' : null
        };
    }

    addClient(): void {
        // No-op in polling implementation
    }

    removeClient(): void {
        // No-op in polling implementation
    }

    async getPositions(manufacturer: string): Promise<PositionData[]> {
        const positions = Array.from(this.positions.values());
        return manufacturer ? 
            positions.filter(pos => pos.manufacturer === manufacturer) : 
            positions;
    }

    async getPositionsMap(): Promise<Map<string, PositionData>> {
        return new Map(this.positions);
    }

    private async pollPositions(icao24List: string[]) {
        if (!await this.rateLimiter.tryAcquire()) {
            errorHandler.handleError(ErrorType.POLLING, 'Rate limit exceeded');
            return;
        }

        try {
            const response = await fetch('/api/opensky/positions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...openSkyAuth.getAuthHeaders()
                },
                body: JSON.stringify({ icao24List })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: PositionData[] = await response.json();
data.forEach(position => {
    this.positions.set(position.icao24, position);
    unifiedCache.setAircraft(position.icao24, toAircraft(position)); // Use the new method
});

            this.rateLimiter.decreasePollingInterval();
            this.updateSubscribers();

        } catch (error) {
            this.rateLimiter.increasePollingInterval();
            errorHandler.handleError(
                ErrorType.POLLING,
                error instanceof Error ? error.message : 'Polling failed'
            );
        }
    }

    private startUpdateLoop() {
        if (this.updateInterval) return;
    
        this.updateInterval = setInterval(() => {
            const now = Date.now();
            const aircraftList: ExtendedAircraft[] = [];
    
            unifiedCache.getAllAircraft().forEach((aircraft) => { // Use the new method
                const interpolated = positionInterpolator.interpolatePosition(aircraft.icao24, now);
                if (interpolated) {
                    aircraftList.push({ ...aircraft, ...interpolated });
                } else {
                    aircraftList.push(aircraft);
                }
            });
    
            this.notifySubscribers(aircraftList);
        }, this.UPDATE_INTERVAL);
    }
    
    async startPolling(icao24List: string[]) {
        if (this.pollingInterval) this.stopPolling();

        await this.pollPositions(icao24List);
        const interval = this.rateLimiter.getCurrentPollingInterval();
        this.pollingInterval = setInterval(
            () => this.pollPositions(icao24List),
            interval
        );
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        this.rateLimiter.resetPollingInterval();
    }

    private updateSubscribers() {
        const aircraftList = Array.from(this.positions.values()).map(toAircraft);
        this.notifySubscribers(aircraftList);
    }

    private notifySubscribers(data: ExtendedAircraft[]): void {
        this.subscribers.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('Error in subscriber callback:', error);
            }
        });
    } 

    async getAircraft(icao24List: string[]): Promise<ExtendedAircraft[]> {
        try {
            if (!this.pollingInterval) {
                await this.startPolling(icao24List);
            }

            const results = await Promise.all(
                icao24List.map(async (icao24) => {
                    const aircraft = unifiedCache.get(icao24); // Use the new method
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
            

            return results.filter((aircraft): aircraft is ExtendedAircraft => aircraft !== null);
        } catch (error) {
            errorHandler.handleError(ErrorType.POLLING, 'Failed to fetch aircraft data');
            return [];
        }
    }

    subscribe(callback: (data: ExtendedAircraft[]) => void): () => void {
        this.subscribers.add(callback);
        return () => {
            this.subscribers.delete(callback);
            if (this.subscribers.size === 0) {
                this.stopPolling();
            }
        };
    }

    async cleanup(): Promise<void> {
        this.stopPolling();
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        this.subscribers.clear();
    }
}

export const openSkyIntegrated = OpenSkyIntegrated.getInstance();