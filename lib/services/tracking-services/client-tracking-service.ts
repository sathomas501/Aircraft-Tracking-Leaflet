// lib/services/client-tracking-service.ts
import { BaseTrackingService } from './base-tracking-service';
import { IcaoBatchService } from '../icao-batch-service';
import { Aircraft } from '@/types/base';
import { CacheManager } from '../managers/cache-manager';
import { getCachedIcao24s } from '../managers/unified-cache-system';

interface Subscriber {
  callback: (aircraft: Aircraft[]) => void;
  manufacturer: string;
}

/**
 * Client-side implementation of the BaseTrackingService
 * Handles client-side tracking with React integration, polling, and UI updates
 */
export class ClientTrackingService extends BaseTrackingService {
  private static instance: ClientTrackingService;
  private pollingInterval: NodeJS.Timeout | null = null;
  private currentManufacturer: string | null = null;
  private currentIcao24s: string[] = [];
  private isPolling: boolean = false;
  private aircraftCache: CacheManager<Aircraft[]>;
  private icaoBatchProcessor: IcaoBatchService;
  private cachedIcao24s: Map<string, string[]> = new Map();
  private pendingRequests: Map<string, Promise<string[]>> = new Map();

  public get isPollingActive(): boolean {
    return this.isPolling;
  }

  private constructor() {
    // Pass appropriate rate limiter options to the base class
    super({
      interval: 60000, // 1 minute in milliseconds
      retryAfter: 1000,
      requestsPerMinute: 60,
      requestsPerDay: 5000,
      maxWaitTime: 30000,
      minPollingInterval: 1000,
      maxPollingInterval: 10000,
      maxBatchSize: 100,
      retryLimit: 3,
      requireAuthentication: true,
      maxConcurrentRequests: 5,
    });

    this.icaoBatchProcessor = new IcaoBatchService();
    this.aircraftCache = new CacheManager<Aircraft[]>(30);

    // Initialize any additional client-specific properties
  }

  public static getInstance(): ClientTrackingService {
    if (!ClientTrackingService.instance) {
      ClientTrackingService.instance = new ClientTrackingService();
    }
    return ClientTrackingService.instance;
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
      this.stopTracking(); // Stop any existing tracking
      console.log(`[ClientTracking] 🔍 Validating database schema...`);
      await fetch('/api/database/validate', { method: 'POST' });

      this.currentManufacturer = manufacturer;

      // Fetch ICAO24s for this manufacturer
      const icao24s = await this.fetchManufacturerIcao24s(manufacturer);
      this.currentIcao24s = icao24s;

      if (this.currentIcao24s.length === 0) {
        console.warn(`[ClientTracking] No ICAO24s found for ${manufacturer}`);
        this.notifySubscribers(manufacturer, []);
        return;
      }

      console.log(
        `[ClientTracking] ✅ ${this.currentIcao24s.length} ICAOs retrieved. Starting tracking...`
      );

      // Initial poll to get data right away
      await this.pollAircraftData();

      // Start regular polling
      this.pollingInterval = setInterval(() => {
        if (!this.isPolling) {
          this.isPolling = true;
          this.pollAircraftData().finally(() => {
            this.isPolling = false;
          });
        } else {
          console.warn(
            '[ClientTracking] ⚠️ Skipping poll - previous request still running.'
          );
        }
      }, pollInterval);
    } catch (error) {
      console.error('[ClientTracking] ❌ Error in startTracking:', error);
      this.notifySubscribers(manufacturer, []); // Ensure subscribers are notified on failure
      this.handleError(error);
    }
  }

  /**
   * Poll aircraft data and update tracking
   */
  public async pollAircraftData(): Promise<void> {
    if (!this.currentManufacturer || !this.currentIcao24s.length) {
      console.warn(
        '[ClientTracking] No manufacturer or ICAO24s set. Skipping poll.'
      );
      return;
    }

    let pollSuccess = false;
    const manufacturer = this.currentManufacturer;

    try {
      console.log(
        `[ClientTracking] Checking tracking database for ${manufacturer}...`
      );

      // First try to get tracked aircraft from the database
      const response = await fetch('/api/aircraft/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getTrackedAircraft',
          manufacturer: manufacturer,
          icao24s: this.currentIcao24s,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch tracked aircraft: ${response.statusText}`
        );
      }

      const data = await response.json();
      const now = Date.now() / 1000;
      let shouldFetchFromOpenSky = false;

      if (data.success && Array.isArray(data.aircraft)) {
        console.log(
          `[ClientTracking] ✅ Found ${data.aircraft.length} aircraft in tracking DB.`
        );

        if (data.aircraft.length > 0) {
          // Check if any aircraft has stale position data (older than 60 seconds)
          shouldFetchFromOpenSky = data.aircraft.some(
            (ac: Aircraft) => now - ac.last_contact > 60
          );

          this.notifySubscribers(manufacturer, data.aircraft);
          pollSuccess = true;
        } else {
          // No aircraft found in tracking DB, try OpenSky
          shouldFetchFromOpenSky = true;
        }
      } else {
        // API returned error or invalid data format, try OpenSky
        shouldFetchFromOpenSky = true;
      }

      // Fetch from OpenSky if needed
      if (shouldFetchFromOpenSky) {
        console.log(`[ClientTracking] Fetching aircraft from OpenSky...`);

        const aircraftData = await this.icaoBatchProcessor.processBatches(
          this.currentIcao24s,
          manufacturer
        );

        if (aircraftData.length > 0) {
          await this.updateTrackingDatabase(aircraftData);
          this.notifySubscribers(manufacturer, aircraftData);
          pollSuccess = true;
        } else {
          console.log('[ClientTracking] No active aircraft found in OpenSky.');
        }
      } else {
        console.log(
          '[ClientTracking] ✅ Skipping OpenSky fetch. Recent data available.'
        );
      }
    } catch (error) {
      console.error('[ClientTracking] ❌ Error polling aircraft data:', error);
      this.notifySubscribers(manufacturer, []);
      this.handleError(error);
    } finally {
      if (!pollSuccess) {
        this.notifySubscribers(manufacturer, []);
      }
    }
  }

  /**
   * Compare two aircraft arrays for changes
   */
  private areAircraftEqual(a: Aircraft[], b: Aircraft[]): boolean {
    if (a.length !== b.length) return false;

    return a.every((aircraft, index) => {
      return (
        aircraft.icao24 === b[index].icao24 &&
        aircraft.latitude === b[index].latitude &&
        aircraft.longitude === b[index].longitude &&
        aircraft.altitude === b[index].altitude
      );
    });
  }

  /**
   * Update aircraft in the tracking database
   */
  private async updateTrackingDatabase(aircraft: Aircraft[]): Promise<void> {
    if (!aircraft.length) {
      console.log(`[ClientTracking] No aircraft data to update.`);
      return;
    }

    const manufacturer = this.currentManufacturer ?? '';
    const cachedAircraft = this.aircraftCache.get(manufacturer);

    // Check if the data has changed to avoid unnecessary updates
    if (cachedAircraft && this.areAircraftEqual(cachedAircraft, aircraft)) {
      console.log(
        `[ClientTracking] ✅ No change in aircraft data. Skipping update.`
      );
      return;
    }

    try {
      console.log(
        `[ClientTracking] ✅ Updating tracking database with ${aircraft.length} aircraft.`
      );

      const response = await fetch('/api/aircraft/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsertActiveAircraftBatch',
          aircraft: aircraft,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to update tracking database: ${response.statusText}`
        );
      }

      const result = await response.json();
      if (result.success) {
        console.log(
          `[ClientTracking] ✅ Successfully updated tracking database`
        );
        this.aircraftCache.set(manufacturer, aircraft);
      } else {
        console.error(
          `[ClientTracking] ❌ Failed to update tracking database:`,
          result.message
        );
      }
    } catch (error) {
      console.error(
        '[ClientTracking] ❌ Failed to update tracking database:',
        error
      );
      throw error;
    }
  }

  /**
   * Fetch aircraft ICAO24 codes for a manufacturer
   * Uses cached data or fetches new data if needed
   * Implementation of the protected method from BaseTrackingService
   */
  protected async fetchManufacturerIcao24s(
    manufacturer: string
  ): Promise<string[]> {
    // Check cache first
    if (this.cachedIcao24s.has(manufacturer)) {
      const cached = this.cachedIcao24s.get(manufacturer);
      return cached || [];
    }

    // Check if there's already a pending request for this manufacturer
    if (this.pendingRequests.has(manufacturer)) {
      try {
        const pending = await this.pendingRequests.get(manufacturer);
        return pending || [];
      } catch (error) {
        console.error(
          `[ClientTracking] Error waiting for pending ICAO24 request:`,
          error
        );
        return [];
      }
    }

    // Create a new request
    try {
      // Create promise that will resolve to a non-null string array
      const safeIcao24sPromise = new Promise<string[]>(async (resolve) => {
        try {
          const result = await getCachedIcao24s(manufacturer);
          resolve(result || []);
        } catch (error) {
          console.error(`[ClientTracking] Error in getCachedIcao24s:`, error);
          resolve([]);
        }
      });

      this.pendingRequests.set(manufacturer, safeIcao24sPromise);

      // Await the result (now guaranteed to be string[])
      const icao24s = await safeIcao24sPromise;

      // Cache results
      this.cachedIcao24s.set(manufacturer, icao24s);
      this.pendingRequests.delete(manufacturer);

      return icao24s;
    } catch (error) {
      console.error(
        `[ClientTracking] Failed to fetch ICAO24s for ${manufacturer}:`,
        error
      );
      this.pendingRequests.delete(manufacturer);
      this.handleError(error);
      return [];
    }
  }

  /**
   * Implement the abstract method from BaseTrackingService
   * This is needed for the TypeScript interface compatibility
   */
  public async getManufacturerIcao24s(manufacturer: string): Promise<string[]> {
    // Make sure we never return null
    try {
      const icao24s = await this.fetchManufacturerIcao24s(manufacturer);
      return icao24s;
    } catch (error) {
      console.error(`[ClientTracking] Error in getManufacturerIcao24s:`, error);
      return [];
    }
  }

  /**
   * Stop tracking and clear active state
   */
  public stopTracking(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    this.currentManufacturer = null;
    this.currentIcao24s = [];
  }

  /**
   * Notify subscribers with updated aircraft data
   */
  protected notifySubscribers(manufacturer: string, data: Aircraft[]): void {
    const subscribers = this.subscriptions.get(manufacturer);
    if (subscribers) {
      subscribers.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[ClientTracking] Subscriber callback error:`, error);
        }
      });
    }
  }

  /**
   * Get all actively tracked aircraft for the current manufacturer
   */
  public async getTrackedAircraft(): Promise<Aircraft[]> {
    if (!this.currentManufacturer) {
      return [];
    }

    try {
      const response = await fetch('/api/tracking/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getTrackedAircraft',
          manufacturer: this.currentManufacturer,
        }),
      });

      const { success, data } = await response.json();

      if (!success || !Array.isArray(data)) {
        console.error('[ClientTracking] ❌ Failed to fetch active aircraft');
        return [];
      }

      console.log(`[ClientTracking] ✅ Found ${data.length} active aircraft.`);
      return data;
    } catch (error) {
      console.error(
        '[ClientTracking] ❌ Error fetching tracked aircraft:',
        error
      );
      this.handleError(error);
      return [];
    }
  }

  /**
   * Clean up resources when the service is destroyed
   */
  public destroy(): void {
    this.stopTracking();
    // Clean up any other resources
  }
}

// Export singleton instance for use in other modules
export const clientTrackingService = ClientTrackingService.getInstance();
