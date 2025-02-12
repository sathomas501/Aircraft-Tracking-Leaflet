import {
  errorHandler,
  ErrorType,
  OpenSkyError,
  OpenSkyErrorCode,
} from '../services/error-handler/error-handler';
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
  maxConcurrentRequests?: number;
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
  private readonly maxConcurrentRequests: number;
  private activeRequests: number = 0;
  public readonly retryLimit: number;
  private lastRequestTime: number = 0;
  private readonly requireAuthentication: boolean;
  private consecutiveFailures: number = 0;
  private backoffTime: number = 3000;
  private cleanupInterval: NodeJS.Timeout;

  constructor(options: RateLimiterOptions) {
    this.requireAuthentication = options.requireAuthentication ?? true;
    const limits = this.requireAuthentication
      ? RATE_LIMITS.AUTHENTICATED
      : RATE_LIMITS.ANONYMOUS;

    // Initialize with 80% of the actual limits for safety margin
    this.requestsPer10Min = Math.floor(limits.REQUESTS_PER_10_MIN * 0.8);
    this.requestsPerDay = Math.floor(limits.REQUESTS_PER_DAY * 0.8);
    this.maxBatchSize = Math.min(
      options.maxBatchSize ||
        OPENSKY_CONSTANTS.RATE_LIMITS.AUTHENTICATED.MAX_BATCH_SIZE,
      Math.floor(limits.BATCH_SIZE * 0.8)
    );

    this.maxWaitTime =
      options.maxWaitTime || RATE_LIMITS.AUTHENTICATED.MAX_WAIT_TIME * 2;
    this.minPollingInterval =
      options.minPollingInterval ||
      OPENSKY_CONSTANTS.RATE_LIMITS.AUTHENTICATED.MIN_INTERVAL * 1.5;
    this.maxPollingInterval =
      options.maxPollingInterval ||
      OPENSKY_CONSTANTS.RATE_LIMITS.AUTHENTICATED.MAX_CONCURRENT * 2;
    this.maxConcurrentRequests = options.maxConcurrentRequests || 5;
    this.retryLimit = options.retryLimit || API_CONFIG.API.MAX_RETRY_LIMIT;
    this.currentPollingInterval = this.minPollingInterval;

    this.validateConfiguration();
    this.cleanupInterval = setInterval(() => this.cleanOldRequests(), 60000);
  }

  public get batchSize(): number {
    return this.maxBatchSize;
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
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

    if (
      this.maxBatchSize >
      OPENSKY_CONSTANTS.RATE_LIMITS.AUTHENTICATED.MAX_ICAO_QUERY
    ) {
      throw new Error(
        `Batch size (${this.maxBatchSize}) exceeds API's global ICAO query limit (${
          OPENSKY_CONSTANTS.RATE_LIMITS.AUTHENTICATED.MAX_ICAO_QUERY
        })`
      );
    }
  }

  private getBackoffWithJitter(): number {
    const jitter = Math.random() * 0.3 + 0.85; // 85-115% of base time
    return Math.floor(this.backoffTime * jitter);
  }

  private async acquireConcurrencySlot(): Promise<boolean> {
    if (this.activeRequests >= this.maxConcurrentRequests) {
      console.warn('[RateLimiter] Max concurrent requests reached');
      return false;
    }
    this.activeRequests++;
    return true;
  }

  private releaseConcurrencySlot(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  public getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  public getRequestsRemaining(): number {
    this.cleanOldRequests();
    return Math.max(0, this.requestsPer10Min - this.tenMinuteRequests.length);
  }

  public async waitForBackoff(): Promise<boolean> {
    if (this.backoffTime > 1000) {
      const jitteredBackoff = this.getBackoffWithJitter();
      console.warn(`[RateLimiter] Backing off for ${jitteredBackoff}ms`);
      await new Promise((resolve) => setTimeout(resolve, jitteredBackoff));

      // Check limits after backoff
      if (!(await this.checkRateLimits())) {
        console.warn('[RateLimiter] Still rate-limited after backoff');
        return false;
      }
    }
    return true;
  }

  public async tryAcquire(): Promise<boolean> {
    this.cleanOldRequests();

    // Check concurrency limit first
    if (!(await this.acquireConcurrencySlot())) {
      return false;
    }

    // If any check fails, release the concurrency slot
    if (this.consecutiveFailures > 0) {
      const canProceed = await this.waitForBackoff();
      if (!canProceed) {
        this.releaseConcurrencySlot();
        return false;
      }
    }

    if (this.dailyRequests.length >= this.requestsPerDay) {
      this.releaseConcurrencySlot();
      console.warn('[RateLimiter] Daily limit reached');
      return false;
    }

    if (this.tenMinuteRequests.length >= this.requestsPer10Min) {
      this.releaseConcurrencySlot();
      console.warn('[RateLimiter] 10-minute rate limit reached');
      return false;
    }

    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    if (timeSinceLastRequest < this.currentPollingInterval) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.currentPollingInterval - timeSinceLastRequest)
      );
    }

    return true;
  }

  private async checkRateLimits(): Promise<boolean> {
    this.cleanOldRequests();

    if (this.dailyRequests.length >= this.requestsPerDay) {
      return false;
    }

    if (this.tenMinuteRequests.length >= this.requestsPer10Min) {
      const waitTime = this.getTimeUntilNextSlot();
      if (waitTime > this.maxWaitTime) {
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    return true;
  }

  public async getNextAvailableSlot(): Promise<Date> {
    this.cleanOldRequests();

    if (!this.isRateLimited()) {
      return new Date(); // Available immediately
    }

    // Check which limit was hit
    if (this.dailyRequests.length >= this.requestsPerDay) {
      // Return start of next day
      const lastDaily = Math.max(...this.dailyRequests);
      return new Date(lastDaily + OPENSKY_CONSTANTS.TIME_WINDOWS.ONE_DAY_MS);
    }

    // Must be 10-minute limit
    const oldestRequest = Math.min(...this.tenMinuteRequests);
    return new Date(
      oldestRequest + OPENSKY_CONSTANTS.TIME_WINDOWS.TEN_MINUTES_MS
    );
  }

  public recordRequest(): void {
    const now = Date.now();
    this.lastRequestTime = now;
    this.tenMinuteRequests.push(now);
    this.dailyRequests.push(now);
    this.cleanOldRequests();

    console.log(
      `[RateLimiter] Recorded request. Remaining requests (10-min): ${this.getRequestsRemaining()}`
    );
  }

  public recordFailure(): void {
    this.consecutiveFailures++;
    this.backoffTime = Math.min(this.backoffTime * 2, 60000); // Max 60 seconds

    // Force immediate rate limit after consecutive failures
    if (this.consecutiveFailures >= 3) {
      this.tenMinuteRequests = new Array(this.requestsPer10Min).fill(
        Date.now()
      );
    }

    console.warn(
      `[RateLimiter] Failure recorded. Backoff increased to ${this.backoffTime}ms`
    );
  }

  public recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.backoffTime = 1000; // Reset to 1 second
  }

  public isRateLimited(): boolean {
    this.cleanOldRequests();
    return (
      this.tenMinuteRequests.length >= this.requestsPer10Min ||
      this.dailyRequests.length >= this.requestsPerDay
    );
  }

  private cleanOldRequests(): void {
    const now = Date.now();
    this.tenMinuteRequests = this.tenMinuteRequests.filter(
      (time) => now - time < OPENSKY_CONSTANTS.TIME_WINDOWS.TEN_MINUTES_MS
    );
    this.dailyRequests = this.dailyRequests.filter(
      (time) => now - time < OPENSKY_CONSTANTS.TIME_WINDOWS.ONE_DAY_MS
    );
  }

  public increasePollingInterval(): void {
    this.currentPollingInterval = Math.min(
      this.currentPollingInterval * 1.5,
      this.maxPollingInterval
    );
    console.log(
      `[RateLimiter] Polling interval increased to ${this.currentPollingInterval}ms`
    );
  }

  public decreasePollingInterval(): void {
    this.currentPollingInterval = Math.max(
      this.currentPollingInterval * 0.8,
      this.minPollingInterval
    );
    console.log(
      `[RateLimiter] Polling interval decreased to ${this.currentPollingInterval}ms`
    );
  }

  public getCurrentPollingInterval(): number {
    return this.currentPollingInterval;
  }

  public async schedule<T>(task: () => Promise<T>): Promise<T> {
    if (!(await this.tryAcquire())) {
      console.warn('[RateLimiter] Task execution blocked due to rate limits');
      throw new OpenSkyError(
        'Rate limit exceeded',
        OpenSkyErrorCode.RATE_LIMIT,
        429
      );
    }

    try {
      const result = await task();
      this.recordSuccess();
      this.decreasePollingInterval();
      return result;
    } catch (error) {
      this.recordFailure();
      this.handleError(error);
      throw error;
    } finally {
      this.releaseConcurrencySlot();
    }
  }

  // Add public getter for batch size
  private handleError(error: unknown): void {
    this.increasePollingInterval();
    if (error instanceof OpenSkyError) {
      errorHandler.handleError(ErrorType.OPENSKY_SERVICE, error.message, {
        code: error.code,
        status: error.statusCode,
      });
    } else if (error instanceof Error) {
      errorHandler.handleError(ErrorType.OPENSKY_SERVICE, error.message, error);
    } else {
      errorHandler.handleError(
        ErrorType.OPENSKY_SERVICE,
        'Unknown error occurred',
        { error }
      );
    }
  }

  public get maxAllowedBatchSize(): number {
    return this.maxBatchSize;
  }

  public getTimeUntilNextSlot(): number {
    if (this.tenMinuteRequests.length === 0) return 0;
    return Math.max(
      0,
      OPENSKY_CONSTANTS.TIME_WINDOWS.TEN_MINUTES_MS -
        (Date.now() - Math.min(...this.tenMinuteRequests))
    );
  }

  public getCurrentState(): Record<string, unknown> {
    return {
      activeRequests: this.activeRequests,
      consecutiveFailures: this.consecutiveFailures,
      currentBackoff: this.backoffTime,
      requestsRemaining: this.getRequestsRemaining(),
      isRateLimited: this.isRateLimited(),
      currentPollingInterval: this.currentPollingInterval,
      timeUntilNextSlot: this.getTimeUntilNextSlot(),
    };
  }
}
