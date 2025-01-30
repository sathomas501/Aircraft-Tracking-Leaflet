// lib/services/polling-service.ts
import axios from 'axios';
import { chunk } from 'lodash';
import { PollingRateLimiter } from './rate-limiter';
import { openSkyAuth } from './opensky-auth';
import { ErrorType } from './error-handler';

// Constants for OpenSky API limits
const OPENSKY_LIMITS = {
    AUTHENTICATED: {
        REQUESTS_PER_10_MIN: 600,
        REQUESTS_PER_DAY: 4000,
        MAX_BATCH_SIZE: 100
    },
    API: {
        MIN_POLLING_INTERVAL: 5000,
        MAX_POLLING_INTERVAL: 30000,
        TIMEOUT_MS: 15000,
        DEFAULT_RETRY_LIMIT: 3
    }
} as const;

export interface PollingConfig {
    url: string;
    pollingInterval?: number;
    batchSize?: number;
    authRequired?: boolean;
    maxRetries?: number;
    cacheEnabled?: boolean;
}

export type PollingHandler = (data: any) => void;
export type ErrorHandler = (error: Error) => void;

export class PollingService {
    private readonly config: Required<PollingConfig>;
    private rateLimiter: PollingRateLimiter;
    private pollingHandler: PollingHandler | null = null;
    private errorHandler: ErrorHandler | null = null;
    private cache: Set<string> = new Set();
    private activeBatches: Set<string> = new Set();
    private pollingIntervalId: NodeJS.Timeout | null = null;
    private isPolling = false;

    constructor(config: PollingConfig) {
        this.config = {
            url: config.url,
            pollingInterval: config.pollingInterval || OPENSKY_LIMITS.API.MIN_POLLING_INTERVAL,
            batchSize: Math.min(
                config.batchSize || OPENSKY_LIMITS.AUTHENTICATED.MAX_BATCH_SIZE,
                OPENSKY_LIMITS.AUTHENTICATED.MAX_BATCH_SIZE
            ),
            authRequired: config.authRequired || true,
            maxRetries: config.maxRetries || OPENSKY_LIMITS.API.DEFAULT_RETRY_LIMIT,
            cacheEnabled: config.cacheEnabled ?? true,
        };

        this.rateLimiter = new PollingRateLimiter({
            requestsPerMinute: OPENSKY_LIMITS.AUTHENTICATED.REQUESTS_PER_10_MIN / 10,
            requestsPerDay: OPENSKY_LIMITS.AUTHENTICATED.REQUESTS_PER_DAY,
            minPollingInterval: OPENSKY_LIMITS.API.MIN_POLLING_INTERVAL,
            maxPollingInterval: OPENSKY_LIMITS.API.MAX_POLLING_INTERVAL,
            maxWaitTime: OPENSKY_LIMITS.API.TIMEOUT_MS,
            retryLimit: OPENSKY_LIMITS.API.DEFAULT_RETRY_LIMIT
        });
    }

    private async fetchBatchPositions(batch: string[]): Promise<void> {
        try {
            const data = await this.fetchBatch(batch);
            if (this.pollingHandler) {
                this.pollingHandler(data);
            }
        } catch (error) {
            this.handleLocalError(error);
        }
    }

    private handleLocalError(error: unknown): void {
        if (error instanceof Error && this.errorHandler) {
            this.errorHandler(error);
        }
    }

    private async fetchBatch(batch: string[]): Promise<any> {
        if (!batch || batch.length === 0) {
            throw new Error('Batch cannot be empty');
        }

        if (batch.length > OPENSKY_LIMITS.AUTHENTICATED.MAX_BATCH_SIZE) {
            throw new Error(`Batch size exceeds OpenSky limit of ${OPENSKY_LIMITS.AUTHENTICATED.MAX_BATCH_SIZE}`);
        }

        try {
            if (this.rateLimiter.isRateLimited()) {
                const nextSlot = await this.rateLimiter.getNextAvailableSlot();
                throw new Error(`Rate limit reached. Next available slot: ${nextSlot}`);
            }

            if (this.config.authRequired && !await openSkyAuth.ensureAuthenticated()) {
                throw new Error('Authentication failed');
            }

            const response = await axios.get('/api/proxy/opensky', {
                params: {
                    icao24: batch.join(',')
                }
            });

            if (!response.data || typeof response.data !== 'object') {
                throw new Error('Invalid response data received');
            }

            this.rateLimiter.recordRequest();
            return response.data;

        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 429) {
                    const nextSlot = await this.rateLimiter.getNextAvailableSlot();
                    throw new Error(`Rate limit exceeded. Next available: ${nextSlot}`);
                }
                throw new Error(`API request failed: ${error.message}`);
            }
            throw error;
        }
    }

    public startPolling(icao24List: string[]): void {
        this.isPolling = true;

        const batches = chunk(icao24List, OPENSKY_LIMITS.AUTHENTICATED.MAX_BATCH_SIZE);
        console.log(`[PollingService] Starting polling with ${batches.length} batches of ${OPENSKY_LIMITS.AUTHENTICATED.MAX_BATCH_SIZE} aircraft each`);

        this.pollingIntervalId = setInterval(async () => {
            if (!this.isPolling) return;

            for (const batch of batches) {
                if (!this.isPolling) break;
                try {
                    await this.fetchBatchPositions(batch);
                } catch (error) {
                    this.handleLocalError(error);
                    // If we hit rate limits, break the batch processing
                    if (error instanceof Error && error.message.includes('rate limit')) {
                        break;
                    }
                }
            }
        }, this.config.pollingInterval);
    }

    public stopPolling(): void {
        console.log('[PollingService] Stopping polling...');
        if (this.pollingIntervalId) {
            clearInterval(this.pollingIntervalId);
            this.pollingIntervalId = null;
        }
        this.isPolling = false;
        this.cache.clear();
        this.activeBatches.clear();
    }

    public isActive(): boolean {
        return this.isPolling;
    }

    public setHandlers(pollingHandler: PollingHandler, errorHandler: ErrorHandler): void {
        this.pollingHandler = pollingHandler;
        this.errorHandler = errorHandler;
    }
}

// Create singleton instance
const defaultPollingService = new PollingService({
    url: '/api/proxy/opensky',
    pollingInterval: OPENSKY_LIMITS.API.MIN_POLLING_INTERVAL,
    batchSize: OPENSKY_LIMITS.AUTHENTICATED.MAX_BATCH_SIZE,
    authRequired: true,
});

// Event handlers
let pollingHandler: PollingHandler | null = null;
let errorHandler: ErrorHandler | null = null;

export function startPolling(icao24List: string[]): void {
    defaultPollingService.setHandlers(
        (data) => pollingHandler?.(data),
        (error) => errorHandler?.(error)
    );
    defaultPollingService.startPolling(icao24List);
}

export function stopPolling(): void {
    defaultPollingService.stopPolling();
}

export function subscribe(
    onData: PollingHandler,
    onError: ErrorHandler
): () => void {
    pollingHandler = onData;
    errorHandler = onError;

    return () => {
        pollingHandler = null;
        errorHandler = null;
        stopPolling();
    };
}