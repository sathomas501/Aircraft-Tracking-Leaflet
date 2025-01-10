// lib/services/rate-limiter.ts
interface RateLimiterOptions {
  maxRequests: number;
  interval: number;
  maxRequestsPerDay?: number;
}

export class RateLimiter {
  private requests: number[] = [];
  private dailyRequests: number[] = [];
  private readonly maxRequests: number;
  private readonly interval: number;
  private readonly maxRequestsPerDay?: number;

  constructor(options: RateLimiterOptions) {
    this.maxRequests = options.maxRequests;
    this.interval = options.interval;
    this.maxRequestsPerDay = options.maxRequestsPerDay;
  }

  private cleanup(): void {
    const now = Date.now();
    
    // Clean up requests older than the rate limit interval
    this.requests = this.requests.filter(time => now - time < this.interval);
    
    // Clean up daily requests older than 24 hours
    if (this.maxRequestsPerDay) {
      this.dailyRequests = this.dailyRequests.filter(time => now - time < 24 * 60 * 60 * 1000);
    }
  }

  public tryAcquire(): boolean {
    this.cleanup();
    
    const now = Date.now();

    // Check interval-based rate limit
    if (this.requests.length >= this.maxRequests) {
      return false;
    }

    // Check daily rate limit
    if (this.maxRequestsPerDay && this.dailyRequests.length >= this.maxRequestsPerDay) {
      return false;
    }

    // Add current request
    this.requests.push(now);
    if (this.maxRequestsPerDay) {
      this.dailyRequests.push(now);
    }

    return true;
  }

  public getTimeUntilNextSlot(): number {
    this.cleanup();
    
    if (this.requests.length < this.maxRequests) {
      return 0;
    }

    return this.interval - (Date.now() - this.requests[0]);
  }

  public getRemainingRequests(): number {
    this.cleanup();
    return Math.max(0, this.maxRequests - this.requests.length);
  }

  public getRemainingDailyRequests(): number | undefined {
    if (!this.maxRequestsPerDay) return undefined;
    
    this.cleanup();
    return Math.max(0, this.maxRequestsPerDay - this.dailyRequests.length);
  }
}