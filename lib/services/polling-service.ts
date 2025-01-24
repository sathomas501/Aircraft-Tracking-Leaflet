import axios from 'axios';
import { chunk } from 'lodash';
import { openSkyAuth } from './opensky-auth';

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

export class PollingService {
    private readonly config: Required<PollingConfig>;
    private pollingIntervalId: NodeJS.Timeout | null = null;
    private isPolling = false;
    private retries = 0;
    private cache: Set<string> = new Set(); // Cache for processed data to avoid redundant calls
    private activeBatches: Set<string> = new Set(); // Track active batches being processed

    private pollingHandler: PollingHandler | null = null;
    private errorHandler: ErrorHandler | null = null;

    constructor(config: PollingConfig) {
        this.config = {
            url: config.url,
            pollingInterval: config.pollingInterval ?? 30000, // Default: 30 seconds
            batchSize: config.batchSize ?? 100,
            authRequired: config.authRequired ?? true,
            maxRetries: config.maxRetries ?? 3,
            cacheEnabled: config.cacheEnabled ?? true,
        };
    }

    public async startPolling(
        icao24List: string[],
        pollingHandler: PollingHandler,
        errorHandler: ErrorHandler
    ): Promise<void> {
        if (this.isPolling) {
            console.log('[PollingService] Already polling. Ignoring start request.');
            return;
        }

        if (!icao24List || icao24List.length === 0) {
            console.warn('[PollingService] No aircraft to poll. Exiting.');
            return;
        }

        this.pollingHandler = pollingHandler;
        this.errorHandler = errorHandler;
        this.isPolling = true;

        console.log('[PollingService] Starting polling...');
        await this.poll(icao24List); // Initial poll

        this.pollingIntervalId = setInterval(async () => {
            if (!this.isPolling) return;

            try {
                await this.poll(icao24List);
            } catch (error: unknown) {
                if (error instanceof Error) {
                    console.error('[PollingService] Error during polling:', error.message);
                    if (this.errorHandler) this.errorHandler(error);
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

    public async fetchBatchPositions(batch: string[]): Promise<void> {
        try {
            if (this.config.authRequired && !(await openSkyAuth.ensureAuthenticated())) {
                throw new Error('[PollingService] Authentication failed.');
            }

            const headers = this.config.authRequired ? openSkyAuth.getAuthHeaders() : {};

            const response = await axios.get(this.config.url, {
                headers,
                params: { icao24: batch.join(',') },
            });

            if (response.data && this.pollingHandler) {
                console.log(`[PollingService] Data received for batch: ${batch.length} aircraft.`);
                this.pollingHandler(response.data);
            } else {
                console.warn('[PollingService] No data received for batch.');
            }
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                const retryAfter = error.response?.headers['retry-after'];
                if (retryAfter) {
                    console.warn(`[PollingService] Rate limited. Retrying after ${retryAfter} seconds.`);
                    await this.delay(parseInt(retryAfter) * 1000);
                    return this.fetchBatchPositions(batch); // Retry after delay
                }
            }

            throw error; // Rethrow for higher-level handling
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    public isActive(): boolean {
        return this.isPolling;
    }

    public clearCache(): void {
        console.log('[PollingService] Clearing cache...');
        this.cache.clear();
    }
}
