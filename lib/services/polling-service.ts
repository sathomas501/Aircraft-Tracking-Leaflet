import axios from 'axios';
import { chunk } from 'lodash';
import { RateLimiter } from './rate-limiter';
import { OpenSkyAuth } from './opensky-auth';

export class PollingService {
    private readonly BATCH_SIZE = 100;
    private readonly POLLING_INTERVAL = 30000;
    private rateLimiter: RateLimiter;
    private auth = OpenSkyAuth.getInstance();
    private pollingInterval: NodeJS.Timeout | null = null;

    constructor(rateLimiter: RateLimiter) {
        this.rateLimiter = rateLimiter;
    }

    startPolling(icao24List: string[], onUpdate: (data: any) => void): void {
        this.pollingInterval = setInterval(async () => {
            try {
                await this.pollPositions(icao24List, onUpdate);
            } catch (error: unknown) {
                if (error instanceof Error) {
                    console.error('[PollingService] Error:', error.message);
                } else {
                    console.error('[PollingService] Unknown error occurred.');
                }
            } // Close the catch block
        }, this.POLLING_INTERVAL); // Close the setInterval callback
    }
    

    stopPolling(): void {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    private async pollPositions(icao24List: string[], onUpdate: (data: any) => void): Promise<void> {
        const batches = chunk(icao24List, this.BATCH_SIZE);
    
        for (const batch of batches) {
            try {
                await this.fetchBatchPositions(batch, onUpdate);
            } catch (error: unknown) {
                if (error instanceof Error) {
                    console.error('[PollingService] Error fetching batch:', error.message);
                } else {
                    console.error('[PollingService] Unknown error during polling.');
                }
            }
        }
    }
    
    private async fetchBatchPositions(batch: string[], onUpdate: (data: any) => void): Promise<void> {
        const username = 'your-username'; // Replace with actual username
        const password = 'your-password'; // Replace with actual password
    
        if (!await this.auth.authenticate(username, password)) {
            throw new Error('Authentication failed.');
        }
    
        const headers = this.auth.getAuthHeaders();
        const url = 'https://opensky-network.org/api/states/all';
    
        try {
            const response = await axios.get(url, {
                headers,
                params: { icao24: batch.join(',') },
            });
            if (response.data?.states) {
                onUpdate(response.data);
            }
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw new Error(`[PollingService] Fetch failed: ${error.message}`);
            } else {
                throw new Error('[PollingService] Unknown error during batch fetch.');
            }
        }
    }
    
}
