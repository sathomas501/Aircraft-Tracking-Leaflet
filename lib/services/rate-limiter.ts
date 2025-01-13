// lib/services/rate-limiter.ts
export interface RateLimiterOptions {
  requestsPerMinute: number;
  requestsPerDay: number;
}

export class RateLimiter {
  private requests: number[] = [];
  private dailyRequests: number[] = [];
  private readonly requestsPerMinute: number;
  private readonly requestsPerDay: number;
  private readonly dayInMs = 24 * 60 * 60 * 1000;
  private readonly minuteInMs = 60 * 1000;

  constructor(options: RateLimiterOptions) {
      this.requestsPerMinute = options.requestsPerMinute;
      this.requestsPerDay = options.requestsPerDay;
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

  public async tryAcquire(): Promise<boolean> {
      this.cleanOldRequests();

      if (this.requests.length >= this.requestsPerMinute || 
          this.dailyRequests.length >= this.requestsPerDay) {
          return false;
      }

      const now = Date.now();
      this.requests.push(now);
      this.dailyRequests.push(now);
      return true;
  }

  public getRemainingRequests(): number {
      this.cleanOldRequests();
      return Math.max(0, this.requestsPerMinute - this.requests.length);
  }

  public getRemainingDailyRequests(): number {
      this.cleanOldRequests();
      return Math.max(0, this.requestsPerDay - this.dailyRequests.length);
  }

  public getTimeUntilNextSlot(): number {
      if (this.requests.length === 0) return 0;
      const oldestRequest = Math.min(...this.requests);
      return Math.max(0, this.minuteInMs - (Date.now() - oldestRequest));
  }
}