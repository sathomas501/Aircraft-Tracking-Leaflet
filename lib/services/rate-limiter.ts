import { errorHandler, ErrorType } from './error-handler';
import { OPENSKY_CONSTANTS } from '../../constants/opensky';
import { RATE_LIMITS } from '@/config/rate-limits';
import { API_CONFIG } from '@/config/api';


export interface RateLimiterOptions {
    requestsPerMinute: number;
    requestsPerDay: number;
    maxWaitTime?: number;
    minPollingInterval?: number;
    maxPollingInterval?: number;
    maxBatchSize?: number;
    retryLimit?: number;
    requireAuthentication?: boolean;
}

export class PollingRateLimiter {
    private tenMinuteRequests: number[] = [];
    private dailyRequests: number[] = [];
    private currentPollingInterval: number;
    private readonly requestsPer10Min: number;
    private readonly requestsPerDay: number;
    private readonly maxWaitTime: number;
    private readonly minPollingInterval: number;
    private readonly maxPollingInterval: number;
    private readonly maxBatchSize: number;
    public readonly retryLimit: number;
    private lastRequestTime: number = 0;
    private readonly requireAuthentication: boolean;

    // ** Add these missing properties **
    private consecutiveFailures: number = 0;
    private backoffTime: number = 1000; // 1 second initial backoff

    constructor(options: RateLimiterOptions) {
        this.requireAuthentication = options.requireAuthentication ?? true;
        
        // Get the appropriate limits based on authentication status
        const limits = this.requireAuthentication 
            ? RATE_LIMITS.AUTHENTICATED 
            : RATE_LIMITS.ANONYMOUS;

        // Set higher limits to account for potential inconsistencies
        this.requestsPer10Min = Math.floor(limits.REQUESTS_PER_10_MIN * 0.8); // Use 80% of limit
        this.requestsPerDay = Math.floor(limits.REQUESTS_PER_DAY * 0.8); // Use 80% of limit
        this.maxBatchSize = Math.min(
            options.maxBatchSize || OPENSKY_CONSTANTS.RATE_LIMITS.AUTHENTICATED.MAX_BATCH_SIZE,
            Math.floor(limits.BATCH_SIZE * 0.8) // Use 80% of batch size limit
        );
        
        // API-wide settings remain the same regardless of authentication
        // Increase intervals for more conservative timing
        this.maxWaitTime = options.maxWaitTime || RATE_LIMITS.AUTHENTICATED.MAX_WAIT_TIME * 2;
        this.minPollingInterval = options.minPollingInterval || OPENSKY_CONSTANTS.RATE_LIMITS.AUTHENTICATED.MIN_INTERVAL * 1.5;
        this.maxPollingInterval = options.maxPollingInterval || OPENSKY_CONSTANTS.RATE_LIMITS.AUTHENTICATED.MAX_CONCURRENT * 2;
        this.retryLimit = options.retryLimit || API_CONFIG.API.MAX_RETRY_LIMIT;
        this.currentPollingInterval = this.minPollingInterval;

        this.validateConfiguration();
        
        // Auto-cleanup old requests periodically
        setInterval(() => this.cleanOldRequests(), 60000); // Clean every minute
    }

    public recordFailure(): void {
        this.consecutiveFailures++;
        this.backoffTime = Math.min(this.backoffTime * 2, 30000); // Max 30 second backoff
        console.log(`[RateLimiter] Failure recorded. Backoff time: ${this.backoffTime}ms`);
    }

    public recordSuccess(): void {
        this.consecutiveFailures = 0;
        this.backoffTime = 1000; // Reset to 1 second
        this.recordRequest();
    }

    public async waitForBackoff(): Promise<void> {
        if (this.backoffTime > 1000) {
            console.log(`[RateLimiter] Backing off for ${this.backoffTime}ms`);
            await new Promise(resolve => setTimeout(resolve, this.backoffTime));
        }
    }

    public getRequestCount(): number {
        this.cleanOldRequests();
        return this.tenMinuteRequests.length;
    }

    public getRequestsRemaining(): number {
        this.cleanOldRequests();
        return this.requestsPer10Min - this.tenMinuteRequests.length;
    }

    public shouldReset(): boolean {
        return this.consecutiveFailures >= 3;
    }

    public async getTimeUntilReset(): Promise<number> {
        if (this.tenMinuteRequests.length === 0) return 0;
        const oldestRequest = Math.min(...this.tenMinuteRequests);
        return Math.max(0, OPENSKY_CONSTANTS.TIME_WINDOWS.TEN_MINUTES_MS - (Date.now() - oldestRequest));
    }

    private validateConfiguration(): void {
        const limits = this.requireAuthentication 
            ? RATE_LIMITS.AUTHENTICATED 
            : RATE_LIMITS.ANONYMOUS;

        if (this.maxBatchSize > limits.BATCH_SIZE) {
            throw new Error(
                `Batch size (${this.maxBatchSize}) exceeds ${
                    this.requireAuthentication ? 'authenticated' : 'unauthenticated'
                } limit (${limits.BATCH_SIZE})`
            );
        }

        // Additional validation for API's global ICAO query limit
        if (this.maxBatchSize > OPENSKY_CONSTANTS.RATE_LIMITS.AUTHENTICATED.MAX_ICAO_QUERY) {
            throw new Error(
                `Batch size (${this.maxBatchSize}) exceeds API's global ICAO query limit (${
                    OPENSKY_CONSTANTS.RATE_LIMITS.AUTHENTICATED.MAX_ICAO_QUERY
                })`
            );
        }
    }
    
    private async checkRateLimits(): Promise<boolean> {
        this.cleanOldRequests();

        if (this.consecutiveFailures > 0) {
            await this.waitForBackoff();
        }

        if (this.dailyRequests.length >= this.requestsPerDay) {
            console.log('[RateLimiter] Daily limit reached');
            return false;
        }

        if (this.tenMinuteRequests.length >= this.requestsPer10Min) {
            const waitTime = this.getTimeUntilNextSlot();
            console.log(`[RateLimiter] Rate limit reached. Wait time: ${waitTime}ms`);
            if (waitTime > this.maxWaitTime) {
                return false;
            }
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        const timeSinceLastRequest = Date.now() - this.lastRequestTime;
        if (timeSinceLastRequest < this.currentPollingInterval) {
            await new Promise(resolve => setTimeout(resolve, this.currentPollingInterval - timeSinceLastRequest));
        }

        return true;
    }

   // **
 //* Resets the rate limiter state
 //*/
    public reset(): void {
        this.tenMinuteRequests = [];
        this.dailyRequests = [];
        this.lastRequestTime = 0;
        this.consecutiveFailures = 0;
        this.backoffTime = 1000;
        this.resetPollingInterval();
        console.log('[RateLimiter] Rate limiter reset complete');
    }

/**
     * Attempts to acquire a rate limit slot
     * Returns true if successful, false if rate limited
     */
public async tryAcquire(): Promise<boolean> {
    return this.checkRateLimits();
}


    public async schedule(task: () => Promise<void>): Promise<void> {
        if (!await this.checkRateLimits()) {
            return;
        }

        try {
            await task();
            this.recordRequest();
            this.decreasePollingInterval();
        } catch (error) {
            this.handleError(error);
        }
    }

    public recordRequest(): void {
        const now = Date.now();
        this.lastRequestTime = now;
        this.tenMinuteRequests.push(now);
        this.dailyRequests.push(now);
        this.cleanOldRequests();
    }

    public isRateLimited(): boolean {
        this.cleanOldRequests();
        return this.tenMinuteRequests.length >= this.requestsPer10Min ||
               this.dailyRequests.length >= this.requestsPerDay;
    }

    private cleanOldRequests(): void {
        const now = Date.now();
        this.tenMinuteRequests = this.tenMinuteRequests.filter(
            time => now - time < OPENSKY_CONSTANTS.TIME_WINDOWS.TEN_MINUTES_MS
        );
        this.dailyRequests = this.dailyRequests.filter(
            time => now - time < OPENSKY_CONSTANTS.TIME_WINDOWS.ONE_DAY_MS
        );
    }

    public getCurrentPollingInterval(): number {
        return this.currentPollingInterval;
    }

    public increasePollingInterval(): void {
        this.currentPollingInterval = Math.min(
            this.currentPollingInterval * 1.5,
            this.maxPollingInterval
        );
    }

    public decreasePollingInterval(): void {
        if (!this.isRateLimited()) {
            this.currentPollingInterval = Math.max(
                this.currentPollingInterval * 0.8,
                this.minPollingInterval
            );
        }
    }

    public resetPollingInterval(): void {
        this.currentPollingInterval = this.minPollingInterval;
    }

    private getNextDayReset(): Date {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow;
    }

    public getTimeUntilNextSlot(): number {
        if (this.tenMinuteRequests.length === 0) return 0;
        return Math.max(0, OPENSKY_CONSTANTS.TIME_WINDOWS.TEN_MINUTES_MS - 
            (Date.now() - Math.min(...this.tenMinuteRequests)));
    }

    public async getNextAvailableSlot(): Promise<Date> {
        this.cleanOldRequests();
        const waitTime = this.getTimeUntilNextSlot();
        return new Date(Date.now() + Math.max(waitTime, this.currentPollingInterval));
    }

    private handleError(error: unknown): void {
        this.increasePollingInterval();
        if (error instanceof Error) {
            errorHandler.handleError(
                ErrorType.OPENSKY_SERVICE,
                `Rate limiter task failed: ${error.message}`
            );
        }
    }
}

export interface RateLimiterOptions {
    requestsPerMinute: number;      // Requests per minute (derived from 10-minute limit)
    requestsPerDay: number;         // Daily request limit
    maxWaitTime?: number;          // Maximum time to wait for a rate limit slot
    minPollingInterval?: number;    // Minimum time between requests
    maxPollingInterval?: number;    // Maximum time between requests
    maxBatchSize?: number;         // Maximum ICAOs per request (limited by API.MAX_ICAO_QUERY)
    retryLimit?: number;           // Number of retry attempts
    requireAuthentication?: boolean; // Whether to use authenticated limits
}