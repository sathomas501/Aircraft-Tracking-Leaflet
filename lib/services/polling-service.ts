import axios from 'axios';
import { chunk } from 'lodash';
import { RateLimiter } from './rate-limiter';
import { openSkyAuth } from './opensky-auth';

export class PollingService {
    private readonly BATCH_SIZE = 100;
    private readonly POLLING_INTERVAL = 30000;
    private rateLimiter: RateLimiter;
    private pollingInterval: NodeJS.Timeout | null = null;
    private isPolling = false;

    constructor(rateLimiter: RateLimiter) {
        this.rateLimiter = rateLimiter;
    }

    async startPolling(icao24List: string[], onUpdate: (data: any) => void): Promise<void> {
        if (this.isPolling) {
            console.log('[PollingService] Already polling, ignoring start request');
            return;
        }

        this.isPolling = true;
        console.log('[PollingService] Starting polling for:', icao24List.length, 'aircraft');

        // Initial poll immediately
        await this.pollPositions(icao24List, onUpdate);

        // Then set up interval
        this.pollingInterval = setInterval(async () => {
            if (!this.isPolling) return;

            try {
                await this.pollPositions(icao24List, onUpdate);
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error('[PollingService] Polling error:', errorMessage);
            }
        }, this.POLLING_INTERVAL);
    }

    stopPolling(): void {
        console.log('[PollingService] Stopping polling');
        this.isPolling = false;
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    private async pollPositions(icao24List: string[], onUpdate: (data: any) => void): Promise<void> {
        if (!this.isPolling) return;

        const batches = chunk(icao24List, this.BATCH_SIZE);
        console.log(`[PollingService] Processing ${batches.length} batches of aircraft data`);

        for (const batch of batches) {
            if (!this.isPolling) break;

            try {
                if (await this.rateLimiter.tryAcquire()) {
                    await this.fetchBatchPositions(batch, onUpdate);
                } else {
                    console.log('[PollingService] Rate limit reached, waiting for next interval');
                    break;
                }
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error('[PollingService] Batch error:', errorMessage);
                // Continue with next batch despite errors
            }
        }
    }

    private async fetchBatchPositions(batch: string[], onUpdate: (data: any) => void): Promise<void> {
        try {
            // Changed from canMakeRequest to tryAcquire
            if (await this.rateLimiter.tryAcquire()) {
                const isAuthenticated = await openSkyAuth.authenticate({
                    useEnvCredentials: true
                });
                // ... rest of the method
            } else {
                console.log('[PollingService] Rate limit reached, waiting for next slot');
                await this.rateLimiter.waitForSlot();
                return this.fetchBatchPositions(batch, onUpdate);
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Network error: ${error.message}`);
            } else if (error instanceof Error) {
                throw new Error(`Fetch error: ${error.message}`);
            } else {
                throw new Error('Unknown error during batch fetch');
            }
        }
    }

    isActive(): boolean {
        return this.isPolling;
    }
}