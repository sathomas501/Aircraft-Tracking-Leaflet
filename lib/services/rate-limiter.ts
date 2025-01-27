export interface RateLimiterOptions {
    requestsPerMinute: number;
    requestsPerDay: number;
    maxWaitTime?: number;
    minPollingInterval?: number;
    maxPollingInterval?: number;
    batchSize?: number;
    retryLimit?: number;
}


export class PollingRateLimiter {
    private requests: number[] = [];
    private dailyRequests: number[] = [];
    private currentPollingInterval: number;
    private readonly requestsPerMinute: number;
    private readonly requestsPerDay: number;
    private readonly maxWaitTime: number;
    private readonly minPollingInterval: number;
    private readonly maxPollingInterval: number;
    private readonly batchSize: number;
    private readonly retryLimit: number;
    private lastRequestTime: number = 0;
    private readonly dayInMs = 24 * 60 * 60 * 1000;
    private readonly minuteInMs = 60 * 1000;

    constructor(options: RateLimiterOptions) {
        this.requestsPerMinute = options.requestsPerMinute;
        this.requestsPerDay = options.requestsPerDay;
        this.maxWaitTime = options.maxWaitTime || 60000; // Default: 60 seconds
        this.minPollingInterval = options.minPollingInterval || 1000; // Default: 1 second
        this.maxPollingInterval = options.maxPollingInterval || 30000; // Default: 30 seconds
        this.batchSize = options.batchSize || 100; // Default: 100
        this.retryLimit = options.retryLimit || 3; // Default: 3 retries
        this.currentPollingInterval = this.minPollingInterval;
    }


    public canProceed(): boolean {
        const now = Date.now();
        if (now - this.lastRequestTime >= this.currentPollingInterval) {
            return true;
        }
        return false;
    }

    public recordRequest(): void {
        this.lastRequestTime = Date.now();
        this.requests.push(this.lastRequestTime);

        // Maintain requests within the last minute
        this.requests = this.requests.filter(
            (timestamp) => Date.now() - timestamp < 60000
        );

        // Maintain daily requests
        this.dailyRequests.push(this.lastRequestTime);
        this.dailyRequests = this.dailyRequests.filter(
            (timestamp) => Date.now() - timestamp < 86400000
        );
    }

    public getWaitTime(): number {
        const now = Date.now();
        return Math.max(0, this.minPollingInterval - (now - this.lastRequestTime));
    }

    private cleanOldRequests(): void {
        const now = Date.now();
        this.requests = this.requests.filter(time => now - time < this.minuteInMs);
        this.dailyRequests = this.dailyRequests.filter(time => now - time < this.dayInMs);
    }

    public async tryAcquire(wait: boolean = false): Promise<boolean> {
        this.cleanOldRequests();

        if (this.dailyRequests.length >= this.requestsPerDay) {
            this.increasePollingInterval();
            return false;
        }

        if (this.requests.length < this.requestsPerMinute) {
            const now = Date.now();
            this.requests.push(now);
            this.dailyRequests.push(now);
            this.decreasePollingInterval();
            return true;
        }

        if (!wait) {
            this.increasePollingInterval();
            return false;
        }

        const waitTime = Math.min(this.getTimeUntilNextSlot(), this.maxWaitTime);
        if (waitTime > this.maxWaitTime) {
            this.increasePollingInterval();
            return false;
        }

        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.tryAcquire(false);
    }

    public increasePollingInterval(): void {
        this.currentPollingInterval = Math.min(
            this.currentPollingInterval * 1.5,
            this.maxPollingInterval
        );
    }

    public decreasePollingInterval(): void {
        if (this.getRemainingRequests() > this.requestsPerMinute / 2) {
            this.currentPollingInterval = Math.max(
                this.currentPollingInterval * 0.8,
                this.minPollingInterval
            );
        }
    }

    public getCurrentPollingInterval(): number {
        return this.currentPollingInterval;
    }

    public resetPollingInterval(): void {
        this.currentPollingInterval = this.minPollingInterval;
    }

    public async waitForSlot(): Promise<boolean> {
        return this.tryAcquire(true);
    }

    public getTimeUntilNextSlot(): number {
        if (this.requests.length === 0) return 0;
        const oldestRequest = Math.min(...this.requests);
        return Math.max(0, this.minuteInMs - (Date.now() - oldestRequest));
    }

    public async getNextAvailableSlot(): Promise<Date> {
        this.cleanOldRequests();
        const waitTime = this.getTimeUntilNextSlot();
        return new Date(Date.now() + Math.max(waitTime, this.currentPollingInterval));
    }

    public isRateLimited(): boolean {
        this.cleanOldRequests();
        return this.requests.length >= this.requestsPerMinute ||
               this.dailyRequests.length >= this.requestsPerDay;
    }

    public getRemainingRequests(): number {
        this.cleanOldRequests();
        return this.requestsPerMinute - this.requests.length;
    }

    public getRemainingDailyRequests(): number {
        this.cleanOldRequests();
        return this.requestsPerDay - this.dailyRequests.length;
    }

    public reset(): void {
        this.requests = [];
        this.dailyRequests = [];
        this.resetPollingInterval();
    }
}
