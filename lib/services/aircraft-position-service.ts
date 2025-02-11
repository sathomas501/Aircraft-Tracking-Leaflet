import { RateLimiterOptions } from './rate-limiter';
import { Aircraft, CachedAircraftData } from '@/types/base';
import {
  errorHandler,
  ErrorType,
  OpenSkyError,
  OpenSkyErrorCode,
} from './error-handler';
import { RATE_LIMITS } from '@/config/rate-limits';
import { API_CONFIG } from '@/config/api';
import {
  AircraftTransforms,
  CacheTransforms,
} from '../../utils/aircraft-transform';
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

export class AircraftPositionService extends BaseTrackingService {
  private static instance: AircraftPositionService;
  private positionHistory: Map<string, Position[]> = new Map();
  private positions: Map<string, CachedAircraftData>;
  private readonly POLL_TIMEOUT = 10000;
  private readonly CACHE_EXPIRATION = 30 * 60 * 1000; // 30 minutes

  private constructor() {
    const rateLimiterOptions: RateLimiterOptions = {
      requestsPerMinute: RATE_LIMITS.AUTHENTICATED.REQUESTS_PER_10_MIN / 10,
      requestsPerDay: RATE_LIMITS.AUTHENTICATED.REQUESTS_PER_DAY,
      maxBatchSize: RATE_LIMITS.AUTHENTICATED.BATCH_SIZE,
      minPollingInterval: RATE_LIMITS.AUTHENTICATED.MIN_INTERVAL,
      maxPollingInterval: RATE_LIMITS.AUTHENTICATED.MAX_CONCURRENT,
      retryLimit: RATE_LIMITS.AUTHENTICATED.MAX_RETRY_LIMIT,
      requireAuthentication: true,
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

  private async fetchWithRetries(
    batch: string[],
    retries = 3,
    delay = 1000
  ): Promise<Aircraft[]> {
    try {
      return await this.fetchPositionData(batch);
    } catch (error) {
      if (retries > 0) {
        console.warn(
          `[AircraftPosition] Retry ${4 - retries}/3 in ${delay}ms`,
          error
        );
        await new Promise((res) => setTimeout(res, delay));
        return this.fetchWithRetries(batch, retries - 1, delay * 2);
      }
      throw error;
    }
  }

  public async getPositionsForIcao24s(icao24s: string[]): Promise<Aircraft[]> {
    const MAX_OPENSKY_BATCH = RATE_LIMITS.AUTHENTICATED.BATCH_SIZE;

    // Remove cached entries to avoid unnecessary requests
    const freshIcao24s = icao24s.filter((icao) => {
      const cached = this.positions.get(icao);
      return !cached || Date.now() - cached.lastUpdated > this.POLL_TIMEOUT;
    });

    if (freshIcao24s.length === 0) {
      return Array.from(
        icao24s
          .map((icao) => {
            const cached = this.positions.get(icao);
            return cached ? CacheTransforms.fromCache(cached) : null;
          })
          .filter((a) => a !== null)
      ) as Aircraft[];
    }

    const batchPromises = freshIcao24s.map((batch) =>
      this.fetchWithRetries([batch])
    );

    const results = await Promise.allSettled(batchPromises);
    return results
      .filter((res) => res.status === 'fulfilled')
      .flatMap((res) => (res as PromiseFulfilledResult<Aircraft[]>).value);
  }

  private async fetchPositionData(icao24s: string[]): Promise<Aircraft[]> {
    try {
      // Try cache first
      const cacheKey = icao24s.join('|');
      const cachedData = await this.cacheService.getLiveData(cacheKey);

      // Type guard for cached data
      if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
        console.log('[AircraftPosition] Using cached position data');
        return cachedData;
      }

      if (!(await this.rateLimiter.tryAcquire())) {
        const waitTime = this.rateLimiter.getTimeUntilNextSlot();
        console.log('[AircraftPosition] Rate limited', { waitTime });
        throw new OpenSkyError(
          `Rate limited. Wait time: ${waitTime}ms`,
          OpenSkyErrorCode.RATE_LIMIT,
          429
        );
      }

      const queryParams = new URLSearchParams({
        time: Math.floor(Date.now() / 1000).toString(),
        icao24: icao24s.join(','),
      });

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/states/all?${queryParams}`,
        {
          signal: AbortSignal.timeout(this.POLL_TIMEOUT),
        }
      );

      if (!response.ok) {
        throw new OpenSkyError(
          `HTTP error! status: ${response.status}`,
          OpenSkyErrorCode.INVALID_DATA,
          response.status
        );
      }

      const data = await response.json();
      const aircraft = AircraftTransforms.fromOpenSkyStates(data.states || []);

      // Update cache and positions
      if (aircraft.length > 0) {
        await this.cacheService.setLiveData(cacheKey, aircraft);
        aircraft.forEach((a) => {
          this.positions.set(a.icao24, AircraftTransforms.toCachedData(a));
        });
      }

      this.rateLimiter.recordSuccess();
      return aircraft;
    } catch (error) {
      this.rateLimiter.recordFailure();
      this.handleError(error);
      throw error;
    }
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
