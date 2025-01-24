// lib/services/manufacturer-tracking-service.ts
import { PollingRateLimiter } from './rate-limiter';
import { errorHandler, ErrorType } from './error-handler';
import { unifiedCache } from './managers/unified-cache-system';
import { openSkyAuth } from './opensky-auth';
import { OpenSkyStateImpl } from './opensky/OpenSkyStateImpl';

interface TrackingState {
    activeManufacturer: string | null;
    icao24List: string[];
    isPolling: boolean;
    lastPollTime: number;
    rateLimitInfo: {
        remainingRequests: number;
        remainingDaily: number;
    };
}

class ManufacturerTrackingService {
    private state: TrackingState;
    private rateLimiter: PollingRateLimiter;

    constructor() {
        this.state = {
            activeManufacturer: null,
            icao24List: [],
            isPolling: false,
            lastPollTime: 0,
            rateLimitInfo: {
                remainingRequests: 0,
                remainingDaily: 0
            }
        };

        this.rateLimiter = new PollingRateLimiter({
            requestsPerMinute: 60,
            requestsPerDay: 1000,
            minPollingInterval: 5000,
            maxPollingInterval: 30000
        });
    }

    private async pollData(): Promise<void> {
        if (!await this.rateLimiter.tryAcquire()) {
            errorHandler.handleError(ErrorType.POLLING, 'Rate limit exceeded');
            return;
        }
    
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
    
            const response = await fetch('https://opensky-network.org/api/states/all', {
                headers: openSkyAuth.getAuthHeaders(),
                signal: controller.signal
            });
    
            clearTimeout(timeoutId);
    
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
    
            const data = await response.json();
            this.updateCache(data.states as OpenSkyStateImpl[]);
            this.rateLimiter.decreasePollingInterval();
            
        } catch (error) {
            this.rateLimiter.increasePollingInterval();
            errorHandler.handleError(
                ErrorType.POLLING,
                error instanceof Error ? error.message : 'Polling failed'
            );
        }
    }

    public async startPolling(manufacturer: string, icao24List: string[]): Promise<void> {
        if (!manufacturer || icao24List.length === 0) {
            throw new Error('Invalid manufacturer or ICAO24 list');
        }

        this.stopPolling();

        this.state.activeManufacturer = manufacturer;
        this.state.icao24List = icao24List;
        this.state.isPolling = true;

        await this.pollData();
        this.schedulePoll();
    }

    private schedulePoll(): void {
        if (!this.state.isPolling) return;

        const interval = this.rateLimiter.getCurrentPollingInterval();
        setTimeout(() => {
            this.pollData().then(() => this.schedulePoll());
        }, interval);
    }

    public stopPolling(): void {
        this.state.isPolling = false;
        this.state.activeManufacturer = null;
        this.state.icao24List = [];
        this.rateLimiter.resetPollingInterval();
    }

    private updateCache(data: OpenSkyStateImpl[]): void {
        unifiedCache.updateFromPolling(data);
        this.state.lastPollTime = Date.now();
        this.state.rateLimitInfo = {
            remainingRequests: this.rateLimiter.getRemainingRequests(),
            remainingDaily: this.rateLimiter.getRemainingDailyRequests()
        };
    }

    public getTrackingStatus() {
        return {
            isTracking: this.state.isPolling,
            manufacturer: this.state.activeManufacturer,
            aircraftCount: this.state.icao24List.length,
            lastPollTime: this.state.lastPollTime,
            rateLimitInfo: this.state.rateLimitInfo
        };
    }
}

export const manufacturerTracking = new ManufacturerTrackingService();