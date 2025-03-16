// lib/services/base-tracking-service.ts
import { PollingRateLimiter, RateLimiterOptions } from '../rate-limiter';
import UnifiedCacheService from '../managers/unified-cache-system';
import { Aircraft, OpenSkyStateArray, CachedAircraftData } from '@/types/base';
import {
  errorHandler,
  ErrorType,
  OpenSkyError,
} from '../error-handler/error-handler';
import { OpenSkyTransforms } from '@/utils/aircraft-transform1';
import trackingDatabaseManager from '../../db/managers/trackingDatabaseManager';
import cacheService from '../managers/cache-manager';

/**
 * Safely require a module with a fallback
 * @param modulePath Path to the module to require
 * @param fallback Fallback value if the require fails
 * @returns Module default export or fallback value
 */
async function safeImport<T>(modulePath: string, fallback: T): Promise<T> {
  try {
    const module = await import(/* webpackIgnore: true */ modulePath);
    return module.default || module || fallback;
  } catch (error) {
    console.warn(`Failed to import module: ${modulePath}`, error);
    return fallback;
  }
}

export abstract class BaseTrackingService {
  protected rateLimiter: PollingRateLimiter;
  protected unifiedCache: UnifiedCacheService;
  protected subscriptions: Map<string, Set<(data: Aircraft[]) => void>>;
  protected trackingDatabaseManager: any = null;
  protected cacheService: any = null;
  protected isServer: boolean;
  protected baseUrl: string;
  protected readonly DEBUG = true;
  protected readonly POLL_TIMEOUT = 10000;
  protected readonly CACHE_EXPIRATION = 30 * 60 * 1000; // 30 minutes

  constructor(rateLimiterOptions: RateLimiterOptions) {
    this.rateLimiter = new PollingRateLimiter(rateLimiterOptions);
    this.unifiedCache = UnifiedCacheService.getInstance();
    this.subscriptions = new Map();
    this.isServer = typeof window === 'undefined';
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // Initialize database managers on server side
    if (this.isServer) {
      try {
        this.trackingDatabaseManager = trackingDatabaseManager;
        this.cacheService = cacheService;

        if (this.DEBUG) {
          if (this.trackingDatabaseManager && this.cacheService) {
            console.log(
              '[BaseTrackingService] Initialized with database and cache managers'
            );
          } else {
            console.log(
              '[BaseTrackingService] Partially initialized. Some managers are missing.',
              {
                dbManager: !!this.trackingDatabaseManager,
                cacheService: !!this.cacheService,
              }
            );
          }
        }
      } catch (error) {
        console.error(
          '[BaseTrackingService] Failed to load database or cache manager:',
          error
        );
      }
    }
  }

  // Common methods for all services
  protected async fetchOpenSkyData(
    icao24s: string[],
    manufacturer: string = ''
  ): Promise<OpenSkyStateArray[]> {
    if (!icao24s || icao24s.length === 0) return [];

    try {
      if (this.DEBUG) {
        console.log('[BaseTrackingService] Requesting OpenSky data:', {
          count: icao24s.length,
          sample: icao24s.slice(0, 3),
        });
      }

      console.log(
        `[BaseTrackingService] 📡 Tracking service request to OpenSky from ${new Error().stack}`
      );
      const response = await fetch(`${this.baseUrl}/api/proxy/opensky`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          icao24s: icao24s,
        }),
        signal: AbortSignal.timeout(this.POLL_TIMEOUT),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[BaseTrackingService] OpenSky request failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        return [];
      }

      const data = await response.json();
      if (this.DEBUG) {
        console.log('[BaseTrackingService] OpenSky response:', {
          success: data.success,
          statesCount: data.data?.states?.length || 0,
          sampleState: data.data?.states?.[0],
        });
      }

      if (!data.success || !data.data?.states) {
        console.warn('[BaseTrackingService] No states in response');
        return [];
      }

      return data.data.states.filter(OpenSkyTransforms.validateState);
    } catch (error) {
      console.error('[BaseTrackingService] OpenSky fetch error:', error);
      return [];
    }
  }

  // Get ICAO24s for a manufacturer - used by multiple services
  public async getManufacturerIcao24s(manufacturer: string): Promise<string[]> {
    // Try unified cache first (in-memory, fastest)
    const unifiedCacheData = this.unifiedCache.getLiveDataRaw(manufacturer);
    if (unifiedCacheData.length > 0) {
      console.log(
        `[BaseTrackingService] ✅ Using unified cache for ${manufacturer}`
      );
      return unifiedCacheData.map((a: CachedAircraftData) => a.icao24);
    }

    // Try persistent cache service
    if (this.cacheService) {
      const persistentCacheKey = `manufacturer-icao24s-${manufacturer}`;
      const persistentCacheData =
        await this.cacheService.get(persistentCacheKey);
      if (persistentCacheData?.length > 0) {
        console.log(
          `[BaseTrackingService] ✅ Using persistent cache for ${manufacturer}`
        );
        // Update unified cache from persistent cache
        this.unifiedCache.setLiveData(manufacturer, persistentCacheData);
        return persistentCacheData.map((a: CachedAircraftData) => a.icao24);
      }
    }

    // Fetch from Static Database if all caches miss
    console.log(
      `[BaseTrackingService] 🔄 Cache miss. Fetching from static DB for ${manufacturer}`
    );

    try {
      // Using null check to avoid errors if static DB manager isn't available
      let icao24List: string[] = [];

      // Try to get ICAO24s from tracking database manager
      if (
        this.trackingDatabaseManager &&
        typeof this.trackingDatabaseManager.getManufacturerIcao24s ===
          'function'
      ) {
        icao24List =
          await this.trackingDatabaseManager.getManufacturerIcao24s(
            manufacturer
          );
      } else {
        console.warn(
          '[BaseTrackingService] No tracking database manager available or missing method'
        );

        // Fallback - try to get ICAO24s via API
        try {
          const response = await fetch(`${this.baseUrl}/api/aircraft/icao24s`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ manufacturer }),
          });

          if (response.ok) {
            const data = await response.json();
            icao24List = data?.data?.icao24List || [];
          }
        } catch (apiError) {
          console.error(
            '[BaseTrackingService] Failed to fetch ICAO24s via API:',
            apiError
          );
        }
      }

      if (!icao24List || icao24List.length === 0) {
        console.warn(
          `[BaseTrackingService] ❌ No ICAO24s found for ${manufacturer}`
        );
        return [];
      }

      // Transform ICAO24 list to `Aircraft` type for caching
      const aircraftData: Aircraft[] = icao24List.map((icao24) => ({
        icao24,
        'N-NUMBER': '',
        manufacturer,
        model: '',
        operator: '',
        NAME: '',
        CITY: '',
        STATE: '',
        OWNER_TYPE: '',
        TYPE_AIRCRAFT: '',
        latitude: 0,
        longitude: 0,
        velocity: 0,
        heading: 0,
        altitude: 0,
        on_ground: false,
        isTracked: false,
        last_contact: Date.now() / 1000,
      }));

      // Cache the transformed `Aircraft` objects
      this.unifiedCache.setLiveData(manufacturer, aircraftData);
      if (this.cacheService) {
        await this.cacheService.set(
          `manufacturer-icao24s-${manufacturer}`,
          aircraftData,
          60 * 60 // Cache for 1 hour
        );
      }

      console.log(
        `[BaseTrackingService] ✅ Cached ${aircraftData.length} ICAO24s for ${manufacturer}`
      );
      return icao24List;
    } catch (error) {
      console.error(`[BaseTrackingService] Error fetching ICAO24s:`, error);
      return [];
    }
  }

  // Process OpenSky data and update positions
  public async updatePositions(
    activeAircraft: OpenSkyStateArray[],
    manufacturer: string
  ): Promise<number> {
    if (!activeAircraft || activeAircraft.length === 0) return 0;

    try {
      // Convert to position format
      const positions = activeAircraft.map((state) => ({
        icao24: state[0],
        latitude: state[6],
        longitude: state[5],
        altitude: state[7],
        velocity: state[9],
        heading: state[10],
        on_ground: state[8],
        last_contact: state[4],
        manufacturer,
      }));

      console.log(
        `[BaseTrackingService] 📡 Updating positions for ${positions.length} aircraft`
      );

      // If server-side with direct DB access
      if (
        this.isServer &&
        this.trackingDatabaseManager &&
        typeof this.trackingDatabaseManager.upsertActiveAircraftBatch ===
          'function'
      ) {
        try {
          const updatedCount =
            await this.trackingDatabaseManager.upsertActiveAircraftBatch(
              positions.map((pos) => ({
                ...pos,
                // Add mandatory fields for the tracking DB
                'N-NUMBER': '',
                model: '',
                NAME: '',
                CITY: '',
                STATE: '',
                OWNER_TYPE: '',
                TYPE_AIRCRAFT: '',
                isTracked: true,
                updated_at: Date.now(),
              }))
            );
          console.log(
            `[BaseTrackingService] ✅ Directly updated ${updatedCount} positions in DB`
          );
          return updatedCount;
        } catch (dbError) {
          console.error(`[BaseTrackingService] ❌ Database error:`, dbError);
          // Fall back to API method if direct DB access fails
        }
      }

      // Client-side or if direct DB access failed, use API
      const response = await fetch(`${this.baseUrl}/api/tracking/positions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateBatch', positions }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update positions: ${response.statusText}`);
      }

      const result = await response.json();
      const updated = result.updated || positions.length;
      console.log(
        `[BaseTrackingService] ✅ Successfully updated ${updated} positions via API`
      );
      return updated;
    } catch (error) {
      console.error(
        `[BaseTrackingService] ❌ Failed to update aircraft positions:`,
        error
      );
      return 0;
    }
  }

  // Standard caching methods - using interface methods from UnifiedCacheService
  protected async getCachedData<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds = 300
  ): Promise<T | null> {
    // Check unified cache first - using getLiveData instead of get
    const cachedData = this.unifiedCache.getLiveData(key);
    if (cachedData && cachedData.length > 0) {
      return cachedData as unknown as T;
    }

    // Check persistent cache if available
    if (this.cacheService && typeof this.cacheService.get === 'function') {
      const persistentData = await this.cacheService.get(key);
      if (persistentData) {
        // Update unified cache from persistent cache - using setLiveData instead of set
        this.unifiedCache.setLiveData(key, persistentData);
        return persistentData as T;
      }
    }

    // If not in cache, fetch fresh data
    try {
      const freshData = await fetchFn();

      // Update caches - using setLiveData instead of set
      this.unifiedCache.setLiveData(key, freshData as any);
      if (this.cacheService && typeof this.cacheService.set === 'function') {
        await this.cacheService.set(key, freshData, ttlSeconds);
      }

      return freshData;
    } catch (error) {
      console.error(
        `[BaseTrackingService] ❌ Error fetching data for key ${key}:`,
        error
      );
      return null;
    }
  }

  // Standard subscription methods
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
      subscribers.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(
            `[BaseTrackingService] Subscriber callback error:`,
            error
          );
        }
      });
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

  // Standard error handling
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

  // Abstract methods that all derived classes must implement
  abstract destroy(): void;

  // Add these abstract methods that are required by TrackingServices
  abstract startTracking(
    manufacturer: string,
    pollInterval?: number
  ): Promise<void>;
  abstract stopTracking(manufacturer: string): void;
}
