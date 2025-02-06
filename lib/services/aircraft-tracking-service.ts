// lib/services/aircraft-tracking-service.ts
import { Aircraft, TrackingData } from '@/types/base';
import { PollingRateLimiter, RateLimiterOptions } from './rate-limiter';
import UnifiedCacheService from './managers/unified-cache-system';
import { errorHandler, ErrorType } from './error-handler';
import { RATE_LIMITS } from '@/config/rate-limits';
import { AircraftTransforms, DatabaseTransforms } from '@/utils/aircraft-transform';

interface TrackingState {
  trackedIcao24s: Set<string>;
  pollingActive: boolean;
  staticData: Map<string, Partial<Aircraft>>;
  subscriptions: Map<string, Set<(data: Aircraft[]) => void>>;
  aircraftData: Map<string, Aircraft>;
}

const BATCH_SIZES = {
  SUPER_BATCH: 1000,  // Maximum ICAOs per full request
  SUB_BATCH: 50       // Maximum ICAOs per individual request
} as const;

export class AircraftTrackingService {
  private static instance: AircraftTrackingService;
  private state: TrackingState;
  private rateLimiter: PollingRateLimiter;
  private cacheService: UnifiedCacheService;
  private readonly POLL_TIMEOUT = 10000;
  private pollTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.state = {
      trackedIcao24s: new Set(),
      pollingActive: false,
      staticData: new Map(),
      subscriptions: new Map(),
      aircraftData: new Map()
    };

    const rateLimiterOptions: RateLimiterOptions = {
      requestsPerMinute: RATE_LIMITS.AUTHENTICATED.REQUESTS_PER_10_MIN / 10,
      requestsPerDay: RATE_LIMITS.AUTHENTICATED.REQUESTS_PER_DAY,
      maxBatchSize: RATE_LIMITS.AUTHENTICATED.BATCH_SIZE,
      minPollingInterval: RATE_LIMITS.AUTHENTICATED.MIN_INTERVAL,
      maxPollingInterval: RATE_LIMITS.AUTHENTICATED.MAX_CONCURRENT,
      retryLimit: RATE_LIMITS.AUTHENTICATED.MAX_RETRY_LIMIT,
      requireAuthentication: true
    };
    
    this.rateLimiter = new PollingRateLimiter(rateLimiterOptions);
    this.cacheService = UnifiedCacheService.getInstance();
  }

  public static getInstance(): AircraftTrackingService {
    if (!AircraftTrackingService.instance) {
      AircraftTrackingService.instance = new AircraftTrackingService();
    }
    return AircraftTrackingService.instance;
  }

  public subscribe(key: string, callback: (data: Aircraft[]) => void): () => void {
    if (!this.state.subscriptions.has(key)) {
      this.state.subscriptions.set(key, new Set());
    }
    
    const subscribers = this.state.subscriptions.get(key)!;
    subscribers.add(callback);

    // Initial callback with current data if available
    const currentData = Array.from(this.state.aircraftData.values())
      .filter(aircraft => this.state.trackedIcao24s.has(aircraft.icao24));
    if (currentData.length > 0) {
      callback(currentData);
    }

    return () => {
      const subscribers = this.state.subscriptions.get(key);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          this.state.subscriptions.delete(key);
        }
      }
    };
  }

  private notifySubscribers(key: string, data: Aircraft[]): void {
    const subscribers = this.state.subscriptions.get(key);
    if (subscribers) {
      subscribers.forEach(callback => callback(data));
    }
  }

  private async fetchPositionData(icao24Batch: string[]): Promise<Aircraft[]> {
    try {
      if (!await this.rateLimiter.tryAcquire()) {
        console.log('[AircraftTracking] Rate limited, waiting for next slot');
        return [];
      }

      const queryParams = new URLSearchParams({
        time: Math.floor(Date.now() / 1000).toString(),
        icao24: icao24Batch.join(',')
      });

      const response = await fetch(`/api/proxy/opensky?${queryParams}`, {
        signal: AbortSignal.timeout(this.POLL_TIMEOUT)
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      if (!data.states) return [];

      const aircraft = data.states.map((state: any[]) => {
        const baseAircraft = AircraftTransforms.fromOpenSkyState(state);
        const staticInfo = this.state.staticData.get(baseAircraft.icao24);

        return staticInfo 
          ? AircraftTransforms.normalize({ ...baseAircraft, ...staticInfo })
          : baseAircraft;
      });

      this.rateLimiter.recordSuccess();
      return aircraft;
    } catch (error) {
      this.rateLimiter.recordFailure();
      this.handleError(error);
      return [];
    }
  }

  private async updateDatabase(aircraft: Aircraft[]): Promise<void> {
    try {
      const trackingData = DatabaseTransforms.toBatch(aircraft);
      await fetch('/api/aircraft/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'updatePositions',
          positions: trackingData 
        })
      });
    } catch (error) {
      errorHandler.handleError(
        ErrorType.OPENSKY_SERVICE,
        'Database update error',
        { error }
      );
    }
  }

  private async pollData(manufacturer: string): Promise<void> {
    if (!this.state.pollingActive || this.state.trackedIcao24s.size === 0) return;

    const icao24Array = Array.from(this.state.trackedIcao24s);
    
    // Process in batches
    for (let i = 0; i < icao24Array.length; i += BATCH_SIZES.SUPER_BATCH) {
      const superBatch = icao24Array.slice(i, i + BATCH_SIZES.SUPER_BATCH);
      
      for (let j = 0; j < superBatch.length; j += BATCH_SIZES.SUB_BATCH) {
        const batch = superBatch.slice(j, j + BATCH_SIZES.SUB_BATCH);
        const aircraft = await this.fetchPositionData(batch);
        
        if (aircraft.length > 0) {
          // Update all states in parallel
          await Promise.all([
            // Update local state
            aircraft.forEach(a => this.state.aircraftData.set(a.icao24, a)),
            
            // Update cache
            this.cacheService.setLiveData(manufacturer, aircraft),
            
            // Update database
            this.updateDatabase(aircraft)
          ]);
          
          // Notify subscribers
          this.notifySubscribers(manufacturer, aircraft);
        }
      }
    }

    // Schedule next poll
    const interval = this.rateLimiter.getCurrentPollingInterval();
    this.pollTimer = setTimeout(() => this.pollData(manufacturer), interval);
  }

  private handleError(error: unknown): void {
    if (error instanceof Error) {
      errorHandler.handleError(
        ErrorType.OPENSKY_SERVICE,
        error.message
      );
    }
  }

  public stopTracking(manufacturer?: string): void {
    if (manufacturer) {
      // Stop tracking specific manufacturer
      const aircraftToRemove = Array.from(this.state.aircraftData.values())
        .filter(a => a.manufacturer === manufacturer)
        .map(a => a.icao24);
      
      aircraftToRemove.forEach(icao => {
        this.state.trackedIcao24s.delete(icao);
        this.state.aircraftData.delete(icao);
      });
      
      this.state.subscriptions.delete(manufacturer);
    } else {
      // Stop all tracking
      this.state.trackedIcao24s.clear();
      this.state.aircraftData.clear();
      this.state.subscriptions.clear();
      this.state.pollingActive = false;
    }

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  public destroy(): void {
    this.stopTracking();
  }
}

export const aircraftTracker = AircraftTrackingService.getInstance();