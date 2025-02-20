import { RateLimiterOptions } from '../rate-limiter';
import { CachedAircraftData } from '@/types/base';
import {
  errorHandler,
  ErrorType,
  OpenSkyError,
} from '../error-handler/error-handler';
import { RATE_LIMITS } from '@/config/rate-limits';

import { BaseTrackingService } from './base-tracking-service';

export interface Position {
  icao24: string;
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  heading: number;
  on_ground: boolean;
  last_contact: number;
}

function isError(err: unknown): err is Error {
  return err instanceof Error;
}

export class AircraftPositionService extends BaseTrackingService {
  private static instance: AircraftPositionService;
  private positions: Map<string, CachedAircraftData>;
  private positionHistory: Map<string, Position[]> = new Map();
  private readonly POLL_TIMEOUT = 10000;
  private readonly CACHE_EXPIRATION = 30 * 60 * 1000; // 30 minutes

  private constructor() {
    const rateLimiterOptions: RateLimiterOptions = {
      requestsPerMinute: RATE_LIMITS.AUTHENTICATED.REQUESTS_PER_10_MIN / 10,
      requestsPerDay: RATE_LIMITS.AUTHENTICATED.REQUESTS_PER_DAY,
      maxBatchSize: RATE_LIMITS.AUTHENTICATED.BATCH_SIZE,
      maxConcurrentRequests: 3, // Add concurrent request limit
      maxWaitTime: 30000, // Add max wait time
      minPollingInterval: RATE_LIMITS.AUTHENTICATED.MIN_INTERVAL,
      maxPollingInterval: RATE_LIMITS.AUTHENTICATED.MAX_CONCURRENT,
      retryLimit: RATE_LIMITS.AUTHENTICATED.MAX_RETRY_LIMIT,
      requireAuthentication: true,
      interval: 60000, // Add appropriate interval value
      retryAfter: 1000, // Add appropriate retryAfter value
    };

    super(rateLimiterOptions);
    this.positions = new Map();

    // Periodically clean old positions
    setInterval(() => this.cleanOldPositions(), 10 * 60 * 1000); // Every 10 min
  }

  public static getInstance(): AircraftPositionService {
    if (!AircraftPositionService.instance) {
      AircraftPositionService.instance = new AircraftPositionService();
    }
    return AircraftPositionService.instance;
  }

  private cleanOldPositions(): void {
    const now = Date.now();
    this.positions.forEach((value, key) => {
      if (now - value.lastUpdated > this.CACHE_EXPIRATION) {
        this.positions.delete(key);
      }
    });
  }

  public getPosition(icao24: string): CachedAircraftData | undefined {
    return this.positions.get(icao24);
  }

  public getPositionHistory(icao24: string): Position[] {
    return this.positionHistory.get(icao24) || [];
  }

  protected handleError(error: unknown): void {
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

  public destroy(): void {
    this.positions.clear();
    this.subscriptions.clear();
  }
}

export const aircraftPositionService = AircraftPositionService.getInstance();
