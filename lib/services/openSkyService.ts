import { PollingRateLimiter } from './rate-limiter';
import { CacheManager } from '@/lib/services/managers/cache-manager';
import { OPENSKY_API_CONFIG } from '@/lib/config/opensky';
import { openSkyAuth } from '@/lib/services/opensky-auth';
import { ExtendedAircraft } from '@/lib/services/opensky-integrated';
import { IOpenSkyService, PositionData, PositionUpdateCallback, OpenSkyState } from '@/types/opensky/index';
import { errorHandler, ErrorType } from './error-handler';
import WebSocket from 'ws';

export class OpenSkyPollingService implements IOpenSkyService {
    private username: string | null = null;
    private cache: CacheManager<PositionData>;
    private rateLimiter: PollingRateLimiter;
    private positionCallbacks: Set<PositionUpdateCallback>;
    private pollInterval: NodeJS.Timeout | null = null;
    private lastUpdate: number = Date.now();

    constructor() {
        this.positionCallbacks = new Set();
        this.cache = new CacheManager<PositionData>(OPENSKY_API_CONFIG.CACHE.TTL.POSITION);
        this.rateLimiter = new PollingRateLimiter({
            requestsPerMinute: OPENSKY_API_CONFIG.RATE_LIMITS.REQUESTS_PER_MINUTE,
            requestsPerDay: OPENSKY_API_CONFIG.RATE_LIMITS.REQUESTS_PER_DAY,
            minPollingInterval: 5000,
            maxPollingInterval: 30000
        });
    }

    async getAircraft(icao24List: string[]): Promise<ExtendedAircraft[]> {
        if (!await this.rateLimiter.tryAcquire()) {
            throw new Error('Rate limit exceeded');
        }

        try {
            const response = await fetch(
                `${OPENSKY_API_CONFIG.BASE_URL}/extended/${icao24List.join(',')}`,
                { headers: openSkyAuth.getAuthHeaders() }
            );
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            errorHandler.handleError(
                ErrorType.POLLING, 
                error instanceof Error ? error.message : 'Failed to fetch aircraft'
            );
            return [];
        }
    }

    async getPositions(icao24List?: string[]): Promise<PositionData[]> {
        if (!await this.rateLimiter.tryAcquire()) {
            throw new Error('Rate limit exceeded');
        }

        try {
            const url = icao24List?.length 
                ? `${OPENSKY_API_CONFIG.BASE_URL}/states/all?icao24=${icao24List.join(',')}`
                : `${OPENSKY_API_CONFIG.BASE_URL}/states/all`;

            const response = await fetch(url, { 
                headers: openSkyAuth.getAuthHeaders() 
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const positions = this.parsePositionData(data.states || []);
            this.updateCache(positions);
            await this.notifyCallbacks(positions);
            return positions;

        } catch (error) {
            errorHandler.handleError(
                ErrorType.POLLING,
                error instanceof Error ? error.message : 'Failed to fetch positions'
            );
            return [];
        }
    }

    startPolling(icao24List: string[]): void {
        if (this.pollInterval) this.stopPolling();

        const poll = async () => {
            try {
                await this.getPositions(icao24List);
                this.rateLimiter.decreasePollingInterval();
            } catch (error) {
                this.rateLimiter.increasePollingInterval();
            }
        };

        poll();
        const interval = this.rateLimiter.getCurrentPollingInterval();
        this.pollInterval = setInterval(poll, interval);
    }

    stopPolling(): void {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        this.rateLimiter.resetPollingInterval();
    }

    private parsePositionData(states: any[]): PositionData[] {
        return states.map(state => ({
            icao24: state[0],
            latitude: state[6] || 0,
            longitude: state[5] || 0,
            altitude: state[7] || 0,
            velocity: state[9] || 0,
            heading: state[10] || 0,
            on_ground: Boolean(state[8]),
            last_contact: state[4] || Date.now() / 1000
        }));
    }

    private updateCache(positions: PositionData[]): void {
        positions.forEach(position => {
            this.cache.set(position.icao24, position);
        });
        this.lastUpdate = Date.now();
    }

    async subscribeToAircraft(icao24s: string[]): Promise<void> {
        this.startPolling(icao24s);
        await this.getPositions(icao24s); // Initial fetch
    }
    
    unsubscribeFromAircraft(icao24s: string[]): void {
        this.stopPolling();
    }

    addClient(): void {
        // No-op in polling implementation
    }

    removeClient(): void {
        // No-op in polling implementation
    }

    getState(): OpenSkyState {
        return {
            authenticated: openSkyAuth.isAuthenticated(),
            connected: this.pollInterval !== null,
            lastUpdate: this.lastUpdate,
            username: this.username
        };
    }

    onPositionUpdate(callback: PositionUpdateCallback): void {
        this.positionCallbacks.add(callback);
    }

    removePositionUpdateCallback(callback: PositionUpdateCallback): void {
        this.positionCallbacks.delete(callback);
    }

    private async notifyCallbacks(positions: PositionData[]): Promise<void> {
        for (const callback of this.positionCallbacks) {
            try {
                await callback(positions);
            } catch (error) {
                console.error('Error in position update callback:', error);
            }
        }
    }

    async cleanup(): Promise<void> {
        this.stopPolling();
        this.positionCallbacks.clear();
        this.cache.flush();
    }
}

export const openSkyPolling = new OpenSkyPollingService();