import { errorHandler, ErrorType } from './error-handler';
import { OPENSKY_CONSTANTS } from '../../constants/opensky';

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

    constructor(options: RateLimiterOptions) {
        this.requireAuthentication = options.requireAuthentication ?? true;
        
        // Get the appropriate limits based on authentication status
        const limits = this.requireAuthentication 
            ? OPENSKY_CONSTANTS.AUTHENTICATED 
            : OPENSKY_CONSTANTS.UNAUTHENTICATED;

        // Set rate limits based on authentication status
        this.requestsPer10Min = limits.REQUESTS_PER_10_MIN;
        this.requestsPerDay = limits.REQUESTS_PER_DAY;
        this.maxBatchSize = Math.min(
            options.maxBatchSize || limits.MAX_BATCH_SIZE,
            limits.MAX_BATCH_SIZE
        );
        
        // API-wide settings remain the same regardless of authentication
        this.maxWaitTime = options.maxWaitTime || OPENSKY_CONSTANTS.API.TIMEOUT_MS;
        this.minPollingInterval = options.minPollingInterval || OPENSKY_CONSTANTS.API.MIN_POLLING_INTERVAL;
        this.maxPollingInterval = options.maxPollingInterval || OPENSKY_CONSTANTS.API.MAX_POLLING_INTERVAL;
        this.retryLimit = options.retryLimit || OPENSKY_CONSTANTS.API.DEFAULT_RETRY_LIMIT;
        this.currentPollingInterval = this.minPollingInterval;

        this.validateConfiguration();
    }

    private validateConfiguration(): void {
        const limits = this.requireAuthentication 
            ? OPENSKY_CONSTANTS.AUTHENTICATED 
            : OPENSKY_CONSTANTS.UNAUTHENTICATED;

        if (this.maxBatchSize > limits.MAX_BATCH_SIZE) {
            throw new Error(
                `Batch size (${this.maxBatchSize}) exceeds ${
                    this.requireAuthentication ? 'authenticated' : 'unauthenticated'
                } limit (${limits.MAX_BATCH_SIZE})`
            );
        }

        // Additional validation for API's global ICAO query limit
        if (this.maxBatchSize > OPENSKY_CONSTANTS.AUTHENTICATED.MAX_ICAO_QUERY) {
            throw new Error(
                `Batch size (${this.maxBatchSize}) exceeds API's global ICAO query limit (${
                    OPENSKY_CONSTANTS.AUTHENTICATED.MAX_ICAO_QUERY
                })`
            );
        }
    }
    

/**
     * Attempts to acquire a rate limit slot
     * Returns true if successful, false if rate limited
     */
public async tryAcquire(): Promise<boolean> {
    return this.checkRateLimits();
}

/**
 * Resets the rate limiter state
 */
public reset(): void {
    this.tenMinuteRequests = [];
    this.dailyRequests = [];
    this.lastRequestTime = 0;
    this.resetPollingInterval();
    console.log('[RateLimiter] Reset complete');
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

    private async checkRateLimits(): Promise<boolean> {
        this.cleanOldRequests();

        // Check daily limit
        if (this.dailyRequests.length >= this.requestsPerDay) {
            errorHandler.handleError(
                ErrorType.OPENSKY_RATE_LIMIT,
                'Daily request limit reached',
                { resetTime: this.getNextDayReset() }
            );
            return false;
        }

        // Check 10-minute limit
        if (this.tenMinuteRequests.length >= this.requestsPer10Min) {
            const waitTime = this.getTimeUntilNextSlot();
            if (waitTime > this.maxWaitTime) {
                errorHandler.handleError(
                    ErrorType.OPENSKY_RATE_LIMIT,
                    'Rate limit reached and wait time too long',
                    { waitTime, maxWaitTime: this.maxWaitTime }
                );
                return false;
            }
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        return true;
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