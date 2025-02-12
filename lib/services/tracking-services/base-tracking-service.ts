import trackingDatabaseManager from '../../db/trackingDatabaseManager';
import { PollingRateLimiter, RateLimiterOptions } from '../rate-limiter';
import UnifiedCacheService from '../../services/managers/unified-cache-system';
import { Aircraft } from '../../../types/base';
import {
  errorHandler,
  ErrorType,
  OpenSkyError,
  OpenSkyErrorCode,
} from '../error-handler/error-handler';

// base-tracking-service.ts
export abstract class BaseTrackingService {
  protected rateLimiter: PollingRateLimiter;
  protected cacheService: UnifiedCacheService;
  protected subscriptions: Map<string, Set<(data: Aircraft[]) => void>>;

  constructor(rateLimiterOptions: RateLimiterOptions) {
    this.rateLimiter = new PollingRateLimiter(rateLimiterOptions);
    this.cacheService = UnifiedCacheService.getInstance();
    this.subscriptions = new Map();
  }

  protected async updateDatabase(aircraft: Aircraft[]): Promise<void> {
    try {
      console.log('[BaseTrackingService] 🔄 Updating database with aircraft:', {
        count: aircraft.length,
        sample: aircraft[0],
      });

      // ✅ Store only live data in tracking database
      for (const a of aircraft) {
        await trackingDatabaseManager.updateAircraftPosition(
          a.icao24,
          a.latitude,
          a.longitude,
          a.heading
        );
      }

      console.log(
        '[BaseTrackingService] ✅ Successfully updated tracking database'
      );
    } catch (error) {
      console.error('[BaseTrackingService] ❌ Database update error:', error);
      errorHandler.handleError(
        ErrorType.DATA,
        'Failed to update aircraft data',
        error
      );
      throw new OpenSkyError(
        'Database update failed',
        OpenSkyErrorCode.INVALID_DATA,
        500
      );
    }
  }

  public subscribe(
    key: string,
    callback: (data: Aircraft[]) => void
  ): () => void {
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }
    this.subscriptions.get(key)!.add(callback);
    return () => this.unsubscribe(key, callback);
  }

  protected notifySubscribers(key: string, data: Aircraft[]): void {
    const subscribers = this.subscriptions.get(key);
    if (subscribers) {
      subscribers.forEach((callback) => callback(data));
    }
  }

  private unsubscribe(key: string, callback: (data: Aircraft[]) => void): void {
    const subscribers = this.subscriptions.get(key);
    if (subscribers) {
      subscribers.delete(callback);
      if (subscribers.size === 0) {
        this.subscriptions.delete(key);
      }
    }
  }

  protected handleError(error: unknown): void {
    if (error instanceof Error) {
      errorHandler.handleError(ErrorType.OPENSKY_SERVICE, error.message);
    }
  }

  abstract destroy(): void;
}
