// lib/services/aircraft-tracker.ts
import axios, { AxiosError } from 'axios';
import { CacheManager } from '@/lib/services/managers/cache-manager';
import { errorHandler, ErrorType } from '@/lib/services/error-handler';

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

interface BatchConfig {
    size: number;
    delayMs: number;
}

export class AircraftTracker {
    private cacheManager: CacheManager<AircraftPosition[]>;
    private lastRequestTime: number = 0;
    private requestCount: number = 0;

    // Validation rules
    private readonly validationRules: ValidationRules = {
        latitude: { min: -90, max: 90 },
        longitude: { min: -180, max: 180 },
        altitude: { min: -1000, max: 60000 },
        velocity: { min: 0, max: 1000 },
        heading: { min: 0, max: 360 }
    };

    // Make batchConfig private but mutable
    private batchConfig = {
        size: 100,
        delayMs: 1000
    };

    constructor(
        private readonly restUrl: string,
        cacheTTL: number,
        batchConfig?: Partial<BatchConfig>
    ) {
        this.cacheManager = new CacheManager<AircraftPosition[]>(cacheTTL);
        if (batchConfig) {
            this.batchConfig = { ...this.batchConfig, ...batchConfig };
        }
    }

    setBatchConfig(config: Partial<BatchConfig>): void {
        this.batchConfig = { ...this.batchConfig, ...config };
    }

    async getPositions(icao24s: string[]): Promise<AircraftPosition[]> {
        if (!icao24s.length) return [];

        // Process in batches
        const batches = this.createBatches(icao24s);
        const allPositions: AircraftPosition[] = [];

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} aircraft)`);

            try {
                const positions = await this.fetchBatchPositions(batch);
                allPositions.push(...positions);

                // Add delay between batches if not the last batch
                if (i < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, this.batchConfig.delayMs));
                }
            } catch (error) {
                console.error(`Error processing batch ${i + 1}:`, error);
                // Continue with next batch even if current fails
            }
        }

        return allPositions;
    }

    private createBatches(icao24s: string[]): string[][] {
        const batches: string[][] = [];
        for (let i = 0; i < icao24s.length; i += this.batchConfig.size) {
            batches.push(icao24s.slice(i, i + this.batchConfig.size));
        }
        return batches;
    }

    private async fetchBatchPositions(icao24s: string[]): Promise<AircraftPosition[]> {
        const cacheKey = icao24s.join(',');
        const cached = this.cacheManager.get(cacheKey);
        if (cached) return cached;

        try {
            const response = await axios.get(this.restUrl, {
                params: { icao24: icao24s.join(',') },
                timeout: 10000
            });

            const rawStates = response.data.states || [];
            const positions = this.parseStates(rawStates);
            
            // Only cache if we got valid positions
            if (positions.length > 0) {
                this.cacheManager.set(cacheKey, positions);
            }

            return positions;
        } catch (error) {
            this.handleError(error, icao24s);
            return [];
        }
    }

    private validatePosition(position: Partial<AircraftPosition>): position is AircraftPosition {
        // Required fields check
        if (!position.icao24 || 
            position.latitude === undefined || 
            position.longitude === undefined) {
            return false;
        }

        // Latitude validation
        if (!this.isValidRange(position.latitude, 
            this.validationRules.latitude.min, 
            this.validationRules.latitude.max)) {
            console.warn(`Invalid latitude for ${position.icao24}: ${position.latitude}`);
            return false;
        }

        // Longitude validation
        if (!this.isValidRange(position.longitude, 
            this.validationRules.longitude.min, 
            this.validationRules.longitude.max)) {
            console.warn(`Invalid longitude for ${position.icao24}: ${position.longitude}`);
            return false;
        }

        // Altitude validation (if provided)
        if (position.altitude !== undefined && 
            !this.isValidRange(position.altitude, 
                this.validationRules.altitude.min, 
                this.validationRules.altitude.max)) {
            console.warn(`Invalid altitude for ${position.icao24}: ${position.altitude}`);
            return false;
        }

        // Velocity validation (if provided)
        if (position.velocity !== undefined && 
            !this.isValidRange(position.velocity, 
                this.validationRules.velocity.min, 
                this.validationRules.velocity.max)) {
            console.warn(`Invalid velocity for ${position.icao24}: ${position.velocity}`);
            return false;
        }

        // Heading validation (if provided)
        if (position.heading !== undefined && 
            !this.isValidRange(position.heading, 
                this.validationRules.heading.min, 
                this.validationRules.heading.max)) {
            console.warn(`Invalid heading for ${position.icao24}: ${position.heading}`);
            return false;
        }

        return true;
    }

    private isValidRange(value: number, min: number, max: number): boolean {
        return !isNaN(value) && isFinite(value) && value >= min && value <= max;
    }

    parseStates(rawStates: any[][]): AircraftPosition[] {
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

                    // Validate the position
                    if (this.validatePosition(position)) {
                        return position;
                    }
                    return null;

                } catch (error) {
                    console.error('[Parse Error] Failed to parse state:', error, state);
                    return null;
                }
            })
            .filter((pos): pos is AircraftPosition => pos !== null);
    }

    clearCache(): void {
        this.cacheManager.flush();
    }

    // In AircraftTracker class, add this method:

private handleError(error: unknown, icao24s: string[]): void {
    if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        if (axiosError.response?.status === 429) {
            errorHandler.handleError(
                ErrorType.RATE_LIMIT, 
                'OpenSky rate limit exceeded', 
                { retryAfter: parseInt(axiosError.response.headers['retry-after'] || '300', 10) }
            );
        } else if (axiosError.response?.status === 403) {
            errorHandler.handleError(
                ErrorType.AUTH, 
                'Authentication failed'
            );
        } else if (axiosError.code === 'ECONNABORTED') {
            errorHandler.handleError(
                ErrorType.NETWORK, 
                'Request timeout'
            );
        } else {
            errorHandler.handleError(
                ErrorType.NETWORK, 
                `Network error: ${axiosError.message}`
            );
        }
    } else {
        errorHandler.handleError(
            ErrorType.DATA,
            `Failed to fetch positions for ${icao24s.length} aircraft`,
            error instanceof Error ? error : new Error('Unknown error')
        );
    }
    
    // Log additional debug information
    console.error('[Aircraft Tracker] Error details:', {
        timestamp: new Date().toISOString(),
        icao24Count: icao24s.length,
        sampleIcao24s: icao24s.slice(0, 5),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error)
    });
}
}