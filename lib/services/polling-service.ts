import axios from 'axios';
import { chunk } from 'lodash';
import { PollingRateLimiter } from './rate-limiter';
import { openSkyAuth } from '../services/opensky-auth';

export interface PollingConfig {
    url: string;
    pollingInterval?: number; // in ms
    batchSize?: number;
    authRequired?: boolean;
    maxRetries?: number;
    cacheEnabled?: boolean; // Enable/disable caching
}

export type PollingHandler = (data: any) => void;
export type ErrorHandler = (error: Error) => void;

export async function pollForActiveAircraft(
    icao24List: string[],
    pollingHandler: PollingHandler,
    errorHandler: ErrorHandler
): Promise<void> {
    const pollingService = new PollingService({
        url: 'https://opensky-network.org/api/states/all', // Replace with your OpenSky endpoint
        pollingInterval: 30000, // 30 seconds
        batchSize: 100,
        authRequired: true,
    });

    await pollingService.startPolling(icao24List, pollingHandler, errorHandler);
}

export class PollingService {
    private readonly config: Required<PollingConfig>;
    private rateLimiter: PollingRateLimiter;
    private pollingHandler: PollingHandler | null = null;
    private errorHandler: ErrorHandler | null = null;
    private cache: Set<string> = new Set();
    private activeBatches: Set<string> = new Set();
    private pollingIntervalId: NodeJS.Timeout | null = null; // Declare pollingIntervalId
    private isPolling = false; // Declare isPolling

    constructor(config: PollingConfig) {
        this.config = {
            url: config.url,
            pollingInterval: config.pollingInterval || 30000,
            batchSize: config.batchSize || 100,
            authRequired: config.authRequired || false,
            maxRetries: config.maxRetries || 5,
            cacheEnabled: config.cacheEnabled || true,
        };
        this.rateLimiter = new PollingRateLimiter({
            requestsPerMinute: 60,
            requestsPerDay: 1000,
            maxWaitTime: 60000,
            minPollingInterval: 1000,
            maxPollingInterval: 30000,
        });
    }
    

    // Main polling function with integrated rate limiter
    private async fetchBatchPositions(batch: string[]): Promise<void> {
        try {
            const data = await this.fetchBatch(batch);
            if (this.pollingHandler) {
                this.pollingHandler(data);
            }
        } catch (error) {
            if (error instanceof Error && this.errorHandler) {
                this.errorHandler(error);
            }
        }
    }

    private async fetchBatch(batch: string[]): Promise<any> {
        await this.rateLimiter.waitForSlot(); // Single rate limit check
        if (!await openSkyAuth.ensureAuthenticated()) {
            throw new Error('Authentication failed');
        }
        
        const response = await axios.get(this.config.url, {
            params: { icao24: batch.join(',') },
            headers: openSkyAuth.getAuthHeaders(),
        });
        return response.data;
    }

    public startPolling(
        batch: string[],
        pollingHandler: PollingHandler,
        errorHandler: ErrorHandler
    ): void {
        this.pollingHandler = pollingHandler;
        this.errorHandler = errorHandler;
        this.isPolling = true;

        this.pollingIntervalId = setInterval(async () => {
            if (!this.isPolling) return;
            try {
                await this.fetchBatchPositions(batch);
            } catch (error) {
                if (error instanceof Error && this.errorHandler) {
                    this.errorHandler(error);
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

    public async poll(icao24List: string[]): Promise<void> {
        const batches = chunk(icao24List, this.config.batchSize);
        console.log(`[PollingService] Processing ${batches.length} batches.`);

        for (const batch of batches) {
            if (!this.isPolling) break;

            const batchKey = batch.join(',');
            if (this.config.cacheEnabled && this.cache.has(batchKey)) {
                console.log(`[PollingService] Skipping cached batch: ${batchKey}`);
                continue;
            }

            // Avoid processing the same batch concurrently
            if (this.activeBatches.has(batchKey)) {
                console.log(`[PollingService] Skipping active batch: ${batchKey}`);
                continue;
            }

            this.activeBatches.add(batchKey);

            try {
                await this.fetchBatchPositions(batch);
                this.cache.add(batchKey); // Cache the batch after successful processing
            } catch (error: unknown) {
                if (error instanceof Error) {
                    console.error(`[PollingService] Error processing batch ${batchKey}:`, error.message);
                    if (this.errorHandler) this.errorHandler(error);
                }
            } finally {
                this.activeBatches.delete(batchKey); // Remove from active batch tracker
            }
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    public clearCache(): void {
        console.log('[PollingService] Clearing cache...');
        this.cache.clear();
    }
}

