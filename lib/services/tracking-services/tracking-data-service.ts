// lib/services/tracking-data-service.ts
import { BaseTrackingService } from './base-tracking-service';
import { AircraftRepository } from '../../repositories/aircraft-repository';
import { TrackingRepository } from '../../repositories/tracking-repository';
import { BaseDatabaseManager } from '../../db/managers/baseDatabaseManager';
import type { Aircraft, OpenSkyStateArray } from '@/types/base';
import { ttlCacheExtension } from '../managers/ttl-cache-extension';

/**
 * Service that coordinates between the repositories and provides
 * business logic for aircraft tracking
 * Extends BaseTrackingService for consistent interface
 */
export class TrackingDataService extends BaseTrackingService {
  protected aircraftRepository: AircraftRepository;
  protected trackingRepository: TrackingRepository;
  protected dbManager: BaseDatabaseManager;
  private static instance: TrackingDataService;

  public constructor(dbManager: BaseDatabaseManager) {
    // Pass appropriate rate limiter options to the base class
    super({
      interval: 60000, // 1 minute in milliseconds
      retryAfter: 500, // milliseconds
      requestsPerMinute: 120,
      requestsPerDay: 10000,
      maxWaitTime: 30000,
      minPollingInterval: 1000,
      maxPollingInterval: 10000,
      maxBatchSize: 100,
      retryLimit: 3,
      requireAuthentication: true,
      maxConcurrentRequests: 5,
    });

    this.dbManager = dbManager;
    this.aircraftRepository = new AircraftRepository(dbManager);
    this.trackingRepository = new TrackingRepository(dbManager);

    console.log(
      '[TrackingDataService] Initialized with database and cache managers'
    );
  }

  /**
   * Get singleton instance
   */
  public static getInstance(
    dbManager: BaseDatabaseManager
  ): TrackingDataService {
    if (!TrackingDataService.instance) {
      TrackingDataService.instance = new TrackingDataService(dbManager);
    }
    return TrackingDataService.instance;
  }

  /**
   * Start tracking aircraft for a specific manufacturer
   * @param manufacturer Manufacturer name
   * @param pollInterval Optional poll interval in milliseconds (default: 30000)
   */
  public async startTracking(
    manufacturer: string,
    pollInterval: number = 30000
  ): Promise<void> {
    try {
      // Add manufacturer to tracked list
      await this.getManufacturerIcao24s(manufacturer);

      // Implement tracking logic - this service doesn't need polling
      // as it handles direct database access and API responses
      console.log(`[TrackingDataService] Started tracking ${manufacturer}`);

      // Notify subscribers with initial data
      const initialData = await this.getTrackedAircraft(manufacturer);
      this.notifySubscribers(manufacturer, initialData);
    } catch (error) {
      console.error('[TrackingDataService] Error starting tracking:', error);
      this.handleError(error);
    }
  }

  /**
   * Stop tracking a manufacturer
   * @param manufacturer Manufacturer name
   */
  public stopTracking(manufacturer: string): void {
    // Clear any active tracking for this manufacturer
    console.log(`[TrackingDataService] Stopped tracking ${manufacturer}`);
  }

  /**
   * Get the database status (counts, health)
   */
  async getDatabaseStatus() {
    return this.trackingRepository.getDatabaseState();
  }

  /**
   * Get all actively tracked aircraft for a manufacturer
   */
  async getTrackedAircraft(manufacturer?: string): Promise<Aircraft[]> {
    const cacheKey = `tracked-aircraft-${manufacturer || 'all'}`;

    try {
      // Try to get from unified cache first (from base class)
      const cachedData = this.unifiedCache.getLiveData(manufacturer || 'all');
      if (cachedData && cachedData.length > 0) {
        console.log(
          `[TrackingDataService] ✅ Using unified cache for ${manufacturer || 'all'}`
        );
        return cachedData;
      }

      // Fetch from repository
      const aircraft =
        await this.aircraftRepository.getTrackedAircraft(manufacturer);

      // Update unified cache
      if (aircraft.length > 0) {
        this.unifiedCache.setLiveData(manufacturer || 'all', aircraft);
      }

      // Notify subscribers
      this.notifySubscribers(manufacturer || 'all', aircraft);

      return aircraft;
    } catch (error) {
      console.error(
        '[TrackingDataService] Error fetching tracked aircraft:',
        error
      );
      this.handleError(error);
      return [];
    }
  }

  /**
   * Get all ICAO24 codes that are being tracked
   */
  // Helper function to safely handle ttlCacheExtension return types
  private async safeGetCached<T>(
    value: Promise<T | null>,
    defaultValue: T
  ): Promise<T> {
    const result = await value;
    return result !== null ? result : defaultValue;
  }

  /**
   * Get all ICAO24 codes that are being tracked
   */
  async getTrackedIcao24s(manufacturer?: string): Promise<string[]> {
    const cacheKey = `tracked-icao24s-${manufacturer || 'all'}`;

    try {
      // Try to get from a temporary storage for ICAO24s
      const cachedIcaosPromise =
        ttlCacheExtension.getWithTTL<string[]>(cacheKey);

      // Use our helper to safely handle the null case - await the promise
      const safeIcaos = await this.safeGetCached(
        cachedIcaosPromise,
        [] as string[]
      );

      if (safeIcaos.length > 0) {
        console.log(`[TrackingDataService] ✅ Using cached ICAO24 list`);
        return safeIcaos;
      }

      // Fetch from repository
      const icaos = manufacturer
        ? await this.trackingRepository.getActiveIcao24s(manufacturer)
        : await this.aircraftRepository.getTrackedICAOs();

      // Update cache
      if (icaos.length > 0) {
        await ttlCacheExtension.setWithTTL(cacheKey, icaos, 5 * 60);
      }

      return icaos;
    } catch (error) {
      console.error(
        '[TrackingDataService] Error fetching tracked ICAO24s:',
        error
      );
      this.handleError(error);
      return [];
    }
  }

  /**
   * Implementation of the abstract method from BaseTrackingService
   */
  public async getManufacturerIcao24s(manufacturer: string): Promise<string[]> {
    try {
      const icaos = await this.getTrackedIcao24s(manufacturer);
      return icaos;
    } catch (error) {
      console.error(
        `[TrackingDataService] Error retrieving ICAO24s for ${manufacturer}:`,
        error
      );
      this.handleError(error);
      return []; // Ensure we always return a string array, never null
    }
  }

  /**
   * Get aircraft by ICAO24 codes
   */
  async getAircraftByIcao24s(
    icao24s: string[],
    manufacturer?: string
  ): Promise<Aircraft[]> {
    if (!icao24s.length) return [];

    try {
      return this.aircraftRepository.getByIcao24(icao24s, manufacturer);
    } catch (error) {
      console.error(
        '[TrackingDataService] Failed to get aircraft by ICAO24:',
        error
      );
      this.handleError(error);
      return [];
    }
  }

  /**
   * Update aircraft positions from OpenSky data
   * Overrides the base class implementation for database integration
   * @param positions OpenSky state arrays
   * @param manufacturer Manufacturer name
   */
  public async updatePositions(
    positions: OpenSkyStateArray[],
    manufacturer: string
  ): Promise<number> {
    if (!positions || positions.length === 0) return 0;

    try {
      // Convert to aircraft position format
      const aircraft: Aircraft[] = positions.map((state) => ({
        icao24: state[0],
        latitude: state[6],
        longitude: state[5],
        altitude: state[7],
        velocity: state[9],
        heading: state[10],
        on_ground: state[8],
        last_contact: state[4],
        manufacturer,
        isTracked: true,
        'N-NUMBER': '',
        model: '',
        TYPE_AIRCRAFT: '',
        OWNER_TYPE: '',
        NAME: '',
        CITY: '',
        STATE: '',
      }));

      console.log(
        `[TrackingDataService] 📡 Updating positions for ${aircraft.length} aircraft`
      );

      // Update database
      const updatedCount =
        await this.aircraftRepository.upsertActiveAircraftBatch(aircraft);

      // Update cache
      this.clearCache(manufacturer);

      // Notify subscribers
      const updatedAircraft = await this.getTrackedAircraft(manufacturer);
      this.notifySubscribers(manufacturer, updatedAircraft);

      return updatedCount;
    } catch (error) {
      console.error('[TrackingDataService] Failed to update positions:', error);
      this.handleError(error);
      return 0;
    }
  }

  /**
   * Update aircraft statuses based on timestamps
   * Method to add to TrackingDataService class
   */
  public async updateAircraftStatuses(): Promise<void> {
    try {
      if (
        this.trackingRepository &&
        typeof this.trackingRepository.updateAircraftStatus === 'function'
      ) {
        await this.trackingRepository.updateAircraftStatus();

        // Invalidate caches after status updates
        this.clearCache('all');
      } else {
        console.warn(
          '[TrackingDataService] Cannot update aircraft statuses - repository method not available'
        );
      }
    } catch (error) {
      console.error(
        '[TrackingDataService] Error updating aircraft statuses:',
        error
      );
      this.handleError(error);
    }
  }

  /**
   * Clear cached data for a manufacturer
   */
  private clearCache(manufacturer: string): void {
    // Clear both the unified cache and TTL cache
    this.unifiedCache.clearCache(manufacturer);
    this.unifiedCache.clearCache('all');

    // Clear TTL cache keys
    ttlCacheExtension.invalidate(`tracked-aircraft-${manufacturer}`);
    ttlCacheExtension.invalidate('tracked-aircraft-all');
    ttlCacheExtension.invalidate(`tracked-icao24s-${manufacturer}`);
    ttlCacheExtension.invalidate('tracked-icao24s-all');
  }

  /**
   * Add aircraft for tracking (pending status)
   */
  async addAircraftForTracking(
    icao24s: string[],
    manufacturer: string
  ): Promise<number> {
    const result = await this.trackingRepository.addPendingAircraft(
      icao24s,
      manufacturer
    );
    this.clearCache(manufacturer);
    return result;
  }

  /**
   * Run maintenance tasks (mark stale, cleanup)
   */
  async performMaintenance(
    manufacturer?: string,
    olderThan?: number
  ): Promise<{ cleaned: number; marked: number }> {
    const result = await this.trackingRepository.performMaintenance();

    // Clear caches after maintenance
    if (manufacturer) {
      this.clearCache(manufacturer);
    } else {
      this.clearCache('all');
    }

    return result;
  }

  /**
   * Get aircraft that need position updates (pending, stale)
   */
  async getAircraftForUpdate(manufacturer?: string): Promise<{
    pending: string[];
    stale: string[];
    active: string[];
  }> {
    const [pending, stale, active] = await Promise.all([
      this.trackingRepository.getPendingIcao24s(manufacturer),
      this.trackingRepository.getStaleIcao24s(manufacturer),
      this.trackingRepository.getActiveIcao24s(manufacturer),
    ]);

    return { pending, stale, active };
  }

  /**
   * Clean up resources when the service is destroyed
   */
  public destroy(): void {
    // Clean up any resources or active operations
    this.subscriptions.clear();
  }

  /**
   * Notify subscribers with updated aircraft data
   * Adds support for manufacturer-specific subscriptions
   */
  protected notifySubscribers(manufacturer: string, data: Aircraft[]): void {
    const subscribers = this.subscriptions.get(manufacturer);
    if (subscribers) {
      subscribers.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(
            `[TrackingDataService] Subscriber callback error:`,
            error
          );
        }
      });
    }
  }
}

// Factory function to create or get the tracking data service
export function createTrackingDataService(
  dbManager: BaseDatabaseManager
): TrackingDataService {
  return TrackingDataService.getInstance(dbManager);
}
