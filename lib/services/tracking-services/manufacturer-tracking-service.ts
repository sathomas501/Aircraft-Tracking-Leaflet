// lib/services/manufacturer-tracking-service.ts
import { BaseTrackingService } from './base-tracking-service';
import { RateLimiterOptions } from '../rate-limiter';

import {
  errorHandler,
  ErrorType,
  OpenSkyError,
  OpenSkyErrorCode,
} from '../error-handler/error-handler';
import { Aircraft } from '@/types/base';
import { RATE_LIMITS } from '@/config/rate-limits';

interface CacheResult {
  aircraft: Aircraft[];
  timestamp: number;
}

interface StaticAircraftData {
  'N-NUMBER': string | undefined;
  manufacturer: string | undefined;
  model: string | undefined;
  NAME: string | undefined;
  CITY: string | undefined;
  STATE: string | undefined;
  TYPE_AIRCRAFT: string | undefined;
  OWNER_TYPE: string | undefined;
}

export class ManufacturerTrackingService extends BaseTrackingService {
  private static instance: ManufacturerTrackingService;
  private staticData: Map<string, StaticAircraftData>;
  private pollTimer: NodeJS.Timeout | null = null;
  private isPolling: boolean = false;
  private readonly POLL_TIMEOUT = 10000;

  private constructor() {
    const rateLimiterOptions: RateLimiterOptions = {
      requestsPerMinute: RATE_LIMITS.AUTHENTICATED.REQUESTS_PER_10_MIN / 10,
      requestsPerDay: RATE_LIMITS.AUTHENTICATED.REQUESTS_PER_DAY,
      maxBatchSize: RATE_LIMITS.AUTHENTICATED.BATCH_SIZE,
      minPollingInterval: RATE_LIMITS.AUTHENTICATED.MIN_INTERVAL,
      maxPollingInterval: RATE_LIMITS.AUTHENTICATED.MAX_CONCURRENT,
      retryLimit: RATE_LIMITS.AUTHENTICATED.MAX_RETRY_LIMIT,
      requireAuthentication: true,
      interval: 60000, // Add appropriate interval value
      retryAfter: 1000, // Add appropriate retryAfter value
    };

    super(rateLimiterOptions);
    this.staticData = new Map();
  }

  public static getInstance(): ManufacturerTrackingService {
    if (!ManufacturerTrackingService.instance) {
      ManufacturerTrackingService.instance = new ManufacturerTrackingService();
    }
    return ManufacturerTrackingService.instance;
  }

  private async fetchStaticData(icao24s: string[]): Promise<void> {
    try {
      // Try cache first
      const cacheKey = icao24s.join('|');
      const cachedData = await this.cacheService.getStaticData(cacheKey);

      if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
        console.log('[ManufacturerTracking] Using cached static data');
        this.staticData = new Map(
          cachedData.map((aircraft: Aircraft) => [
            aircraft.icao24,
            this.extractStaticData(aircraft),
          ])
        );
        return;
      }

      console.log('[ManufacturerTracking] Fetching static data', {
        count: icao24s.length,
        sample: icao24s.slice(0, 3),
      });

      const canProceed = await this.rateLimiter.tryAcquire();
      if (!canProceed) {
        const waitTime = this.rateLimiter.getTimeUntilNextSlot();
        throw new OpenSkyError(
          `Rate limited for static data fetch. Wait time: ${waitTime}ms`,
          OpenSkyErrorCode.RATE_LIMIT,
          429
        );
      }

      const response = await fetch('/api/aircraft/static-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icao24s }),
        signal: AbortSignal.timeout(this.POLL_TIMEOUT),
      });

      if (!response.ok) {
        throw new OpenSkyError(
          'Failed to fetch static data',
          OpenSkyErrorCode.INVALID_DATA,
          response.status
        );
      }

      const staticData: Aircraft[] = await response.json();

      this.staticData = new Map(
        staticData.map((aircraft) => [
          aircraft.icao24,
          this.extractStaticData(aircraft),
        ])
      );

      // Update cache
      await this.cacheService.setStaticData(staticData);
      this.rateLimiter.recordSuccess();
    } catch (error) {
      this.rateLimiter.recordFailure();
      this.handleError(error);
      throw error;
    }
  }

  private extractStaticData(aircraft: Aircraft): StaticAircraftData {
    return {
      'N-NUMBER': aircraft['N-NUMBER'] || undefined,
      manufacturer: aircraft.manufacturer,
      model: aircraft.model,
      NAME: aircraft.NAME || undefined,
      CITY: aircraft.CITY || undefined,
      STATE: aircraft.STATE || undefined,
      TYPE_AIRCRAFT: aircraft.TYPE_AIRCRAFT || undefined,
      OWNER_TYPE: aircraft.OWNER_TYPE || undefined,
    };
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

  public async startTracking(
    manufacturer: string,
    icao24s: string[]
  ): Promise<void> {
    if (!icao24s?.length) {
      throw new OpenSkyError(
        'No ICAO24 codes provided',
        OpenSkyErrorCode.INVALID_REQUEST,
        400
      );
    }

    try {
      await this.fetchStaticData(icao24s);
      this.isPolling = true;
      await this.poll(manufacturer, icao24s);
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  private async poll(manufacturer: string, icao24s: string[]): Promise<void> {
    if (!this.isPolling) return;

    try {
      const positions = await this.fetchPositionData(icao24s);

      if (positions.length > 0) {
        const enrichedPositions = positions.map((pos) => ({
          ...pos,
          ...this.staticData.get(pos.icao24),
        }));

        this.notifySubscribers(manufacturer, enrichedPositions);
      }

      const interval = this.rateLimiter.getCurrentPollingInterval();
      this.pollTimer = setTimeout(
        () => this.poll(manufacturer, icao24s),
        interval
      );
    } catch (error) {
      this.handleError(error);

      // Retry with increased interval
      const interval = this.rateLimiter.getCurrentPollingInterval() * 2;
      this.pollTimer = setTimeout(
        () => this.poll(manufacturer, icao24s),
        interval
      );
    }
  }

  private async fetchPositionData(icao24s: string[]): Promise<Aircraft[]> {
    try {
      const canProceed = await this.rateLimiter.tryAcquire();
      if (!canProceed) {
        const waitTime = this.rateLimiter.getTimeUntilNextSlot();
        throw new OpenSkyError(
          `Rate limited for position fetch. Wait time: ${waitTime}ms`,
          OpenSkyErrorCode.RATE_LIMIT,
          429
        );
      }

      const cacheKey = icao24s.join('|');
      const cachedData = await this.cacheService.getLiveData(cacheKey);
      if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
        console.log('[ManufacturerTracking] Using cached position data');
        return cachedData;
      }

      const response = await fetch('/api/aircraft/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icao24s }),
        signal: AbortSignal.timeout(this.POLL_TIMEOUT),
      });

      if (!response.ok) {
        throw new OpenSkyError(
          'Failed to fetch position data',
          OpenSkyErrorCode.INVALID_DATA,
          response.status
        );
      }

      const data: { positions: Aircraft[] } = await response.json();

      if (data.positions && data.positions.length > 0) {
        // Update cache
        await this.cacheService.setLiveData(cacheKey, data.positions);
      }

      this.rateLimiter.recordSuccess();
      return data.positions || [];
    } catch (error) {
      this.rateLimiter.recordFailure();
      this.handleError(error);
      throw error;
    }
  }

  public stopTracking(): void {
    this.isPolling = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.staticData.clear();
  }

  public destroy(): void {
    this.stopTracking();
    this.subscriptions.clear();
  }
}

export const manufacturerTracking = ManufacturerTrackingService.getInstance();
