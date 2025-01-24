import axios, { AxiosError } from 'axios';
import { CacheManager } from '@/lib/services/managers/cache-manager';
import { errorHandler, ErrorType } from '@/lib/services/error-handler';
import { PollingRateLimiter } from './rate-limiter';

interface AircraftPosition {
    icao24: string;
    latitude: number;
    longitude: number;
    altitude: number;
    velocity: number;
    heading: number;
    lastContact: number;
}

interface ValidationRules {
    latitude: { min: number; max: number };
    longitude: { min: number; max: number };
    altitude: { min: number; max: number };
    velocity: { min: number; max: number };
    heading: { min: number; max: number };
}

export class AircraftTracker {
    private cacheManager: CacheManager<AircraftPosition[]>;
    private rateLimiter: PollingRateLimiter;
    private pollingInterval: NodeJS.Timeout | null = null;

    private readonly validationRules: ValidationRules = {
        latitude: { min: -90, max: 90 },
        longitude: { min: -180, max: 180 },
        altitude: { min: -1000, max: 60000 },
        velocity: { min: 0, max: 1000 },
        heading: { min: 0, max: 360 }
    };

    constructor(
        private readonly restUrl: string,
        cacheTTL: number
    ) {
        this.cacheManager = new CacheManager<AircraftPosition[]>(cacheTTL);
        this.rateLimiter = new PollingRateLimiter({
            requestsPerMinute: 60,
            requestsPerDay: 1000,
            minPollingInterval: 5000,
            maxPollingInterval: 30000
        });
    }

    async startPolling(icao24s: string[], onData: (positions: AircraftPosition[]) => void): Promise<void> {
        if (this.pollingInterval) this.stopPolling();

        const poll = async () => {
            if (!await this.rateLimiter.tryAcquire()) {
                errorHandler.handleError(ErrorType.POLLING, 'Rate limit exceeded');
                return;
            }

            try {
                const positions = await this.getPositions(icao24s);
                onData(positions);
                this.rateLimiter.decreasePollingInterval();
            } catch (error) {
                this.handleError(error, icao24s);
                this.rateLimiter.increasePollingInterval();
            }
        };

        await poll();
        const interval = this.rateLimiter.getCurrentPollingInterval();
        this.pollingInterval = setInterval(poll, interval);
    }

    stopPolling(): void {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        this.rateLimiter.resetPollingInterval();
    }

    private async getPositions(icao24s: string[]): Promise<AircraftPosition[]> {
        if (!icao24s.length) return [];

        const cacheKey = icao24s.join(',');
        const cached = this.cacheManager.get(cacheKey);
        if (cached) return cached;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            const response = await axios.get(this.restUrl, {
                params: { icao24: icao24s.join(',') },
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const positions = this.parseAircraftStates(response.data.states || []);
            if (positions.length) this.cacheManager.set(cacheKey, positions);
            return positions;

        } catch (error) {
            this.handleError(error, icao24s);
            return [];
        }
    }

    private validatePosition(position: Partial<AircraftPosition>): position is AircraftPosition {
        if (!position.icao24 || 
            position.latitude === undefined || 
            position.longitude === undefined) {
            return false;
        }

        if (!this.isValidRange(position.latitude, 
            this.validationRules.latitude.min, 
            this.validationRules.latitude.max)) {
            return false;
        }

        if (!this.isValidRange(position.longitude, 
            this.validationRules.longitude.min, 
            this.validationRules.longitude.max)) {
            return false;
        }

        if (position.altitude !== undefined && 
            !this.isValidRange(position.altitude, 
                this.validationRules.altitude.min, 
                this.validationRules.altitude.max)) {
            return false;
        }

        if (position.velocity !== undefined && 
            !this.isValidRange(position.velocity, 
                this.validationRules.velocity.min, 
                this.validationRules.velocity.max)) {
            return false;
        }

        if (position.heading !== undefined && 
            !this.isValidRange(position.heading, 
                this.validationRules.heading.min, 
                this.validationRules.heading.max)) {
            return false;
        }

        return true;
    }

    private isValidRange(value: number, min: number, max: number): boolean {
        return !isNaN(value) && isFinite(value) && value >= min && value <= max;
    }

    private parseAircraftStates(rawStates: any[][]): AircraftPosition[] {
        return rawStates
            .map(state => {
                try {
                    const [
                        icao24,
                        _callsign,
                        _country,
                        _timePosition,
                        lastContact,
                        longitude,
                        latitude,
                        altitude,
                        _onGround,
                        velocity,
                        heading,
                    ] = state;

                    const position: Partial<AircraftPosition> = {
                        icao24,
                        latitude: Number(latitude),
                        longitude: Number(longitude),
                        altitude: Number(altitude) || 0,
                        velocity: Number(velocity) || 0,
                        heading: Number(heading) || 0,
                        lastContact: Number(lastContact) || Math.floor(Date.now() / 1000)
                    };

                    return this.validatePosition(position) ? position : null;
                } catch (error) {
                    return null;
                }
            })
            .filter((pos): pos is AircraftPosition => pos !== null);
    }

    private handleError(error: unknown, icao24s: string[]): void {
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError;
            
            if (axiosError.response?.status === 429) {
                this.rateLimiter.increasePollingInterval();
                errorHandler.handleError(ErrorType.POLLING, 'Rate limit exceeded');
            } else if (axiosError.response?.status === 403) {
                errorHandler.handleError(ErrorType.AUTH, 'Authentication failed');
            } else {
                errorHandler.handleError(ErrorType.POLLING, axiosError.message);
            }
        } else {
            errorHandler.handleError(
                ErrorType.POLLING,
                `Failed to fetch positions for ${icao24s.length} aircraft`
            );
        }
    }
}