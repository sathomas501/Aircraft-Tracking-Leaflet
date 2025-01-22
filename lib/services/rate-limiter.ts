// lib/services/rate-limiter.ts
export interface RateLimiterOptions {
    requestsPerMinute: number;
    requestsPerDay: number;
    maxWaitTime?: number; // Maximum time to wait for a slot in ms
}

export class RateLimiter {
    private requests: number[] = [];
    private dailyRequests: number[] = [];
    private readonly requestsPerMinute: number;
    private readonly requestsPerDay: number;
    private readonly maxWaitTime: number;
    private readonly dayInMs = 24 * 60 * 60 * 1000;
    private readonly minuteInMs = 60 * 1000;

    constructor(options: RateLimiterOptions) {
        this.requestsPerMinute = options.requestsPerMinute;
        this.requestsPerDay = options.requestsPerDay;
        this.maxWaitTime = options.maxWaitTime || this.minuteInMs;
    }

    private cleanOldRequests(): void {
        const now = Date.now();
        this.requests = this.requests.filter(time => 
            now - time < this.minuteInMs
        );
        this.dailyRequests = this.dailyRequests.filter(time => 
            now - time < this.dayInMs
        );
    }

    public async tryAcquire(wait: boolean = false): Promise<boolean> {
        this.cleanOldRequests();

        if (this.dailyRequests.length >= this.requestsPerDay) {
            return false; // No point waiting if daily limit is reached
        }

        if (this.requests.length < this.requestsPerMinute) {
            const now = Date.now();
            this.requests.push(now);
            this.dailyRequests.push(now);
            return true;
        }

        if (!wait) {
            return false;
        }

        // Calculate wait time for next available slot
        const waitTime = this.getTimeUntilNextSlot();
        if (waitTime > this.maxWaitTime) {
            return false;
        }

        // Wait for next available slot
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.tryAcquire(false); // Try again without waiting
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
        return new Date(Date.now() + waitTime);
    }

    public isRateLimited(): boolean {
        this.cleanOldRequests();
        return this.requests.length >= this.requestsPerMinute ||
               this.dailyRequests.length >= this.requestsPerDay;
    }

    public getRemainingRequests(): number {
        this.cleanOldRequests(); // Ensure outdated requests are removed
        return this.requestsPerMinute - this.requests.length;
    }

    public getRemainingDailyRequests(): number {
        this.cleanOldRequests(); // Ensure outdated daily requests are removed
        return this.requestsPerDay - this.dailyRequests.length;
    }
}