import { BaseTrackingService } from './base-tracking-service';
import { Aircraft, OpenSkyStateArray } from '@/types/base';
import { aircraftPositionService } from './aircraft-position-service';
import { getAircraftTrackingService } from './aircraft-tracking-service';
import { RateLimiterOptions } from '../rate-limiter';

// Define the AircraftRecord interface if it's not imported from elsewhere
interface AircraftRecord {
  icao24: string;
  'N-NUMBER'?: string;
  manufacturer?: string;
  model?: string;
  operator?: string;
  NAME?: string;
  CITY?: string;
  STATE?: string;
  OWNER_TYPE?: string;
  TYPE_AIRCRAFT?: string;
}

interface ManufacturerTrackingState {
  activeIcao24s: Set<string>;
  pendingIcao24s: Set<string>;
  lastUpdate: number;
  isTracking: boolean;
  pollingInterval: NodeJS.Timeout | null;
}

/**
 * Service for tracking aircraft by manufacturer
 */
export class ManufacturerTrackingService extends BaseTrackingService {
  private trackingStates: Map<string, ManufacturerTrackingState>;
  private static instance: ManufacturerTrackingService;
  private readonly DEFAULT_POLL_INTERVAL = 30000; // 30 seconds

  private constructor() {
    // Initialize with appropriate rate limiter options
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

    this.trackingStates = new Map();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ManufacturerTrackingService {
    if (!ManufacturerTrackingService.instance) {
      ManufacturerTrackingService.instance = new ManufacturerTrackingService();
    }
    return ManufacturerTrackingService.instance;
  }

  /**
   * Start tracking aircraft for a manufacturer
   * @param manufacturer Manufacturer name
   * @param pollInterval Optional poll interval in milliseconds
   */
  public async startTracking(
    manufacturer: string,
    pollInterval: number = this.DEFAULT_POLL_INTERVAL
  ): Promise<void> {
    if (!manufacturer) {
      console.error('[ManufacturerTrackingService] No manufacturer specified');
      return;
    }

    // Initialize or retrieve tracking state
    let state = this.trackingStates.get(manufacturer);
    if (!state) {
      state = {
        activeIcao24s: new Set(),
        pendingIcao24s: new Set(),
        lastUpdate: 0,
        isTracking: false,
        pollingInterval: null,
      };
      this.trackingStates.set(manufacturer, state);
    }

    // Stop existing tracking if active
    if (state.isTracking) {
      this.stopTracking(manufacturer);
    }

    // Mark as tracking
    state.isTracking = true;
    console.log(
      `[ManufacturerTrackingService] Starting tracking for ${manufacturer}`
    );

    // Initial processing
    try {
      await this.processManufacturer(manufacturer);
    } catch (error) {
      console.error(
        `[ManufacturerTrackingService] Error in initial processing:`,
        error
      );
    }

    // Start polling
    state.pollingInterval = setInterval(async () => {
      try {
        await this.processManufacturer(manufacturer);
      } catch (error) {
        console.error(`[ManufacturerTrackingService] Error in polling:`, error);
      }
    }, pollInterval);
  }

  /**
   * Stop tracking aircraft for a manufacturer
   * @param manufacturer Manufacturer name
   */
  public stopTracking(manufacturer: string): void {
    const state = this.trackingStates.get(manufacturer);
    if (!state) return;

    console.log(
      `[ManufacturerTrackingService] Stopping tracking for ${manufacturer}`
    );

    // Clear interval
    if (state.pollingInterval) {
      clearInterval(state.pollingInterval);
      state.pollingInterval = null;
    }

    // Update state
    state.isTracking = false;
  }

  /**
   * Get manufacturer ICAO24 codes
   * @param manufacturer Manufacturer name
   */
  public async getManufacturerIcao24s(manufacturer: string): Promise<string[]> {
    try {
      // For each manufacturer, we store ICAO24 codes in the tracking state
      const state = this.trackingStates.get(manufacturer);
      if (state) {
        const allIcao24s = new Set([
          ...state.activeIcao24s,
          ...state.pendingIcao24s,
        ]);
        if (allIcao24s.size > 0) {
          return Array.from(allIcao24s);
        }
      }

      // If no state exists yet, fetch from other sources (like static database)
      // This would be implemented in your actual code

      return []; // Return empty array if no ICAOs found
    } catch (error) {
      console.error(
        `[ManufacturerTrackingService] Error fetching ICAO24s for ${manufacturer}:`,
        error
      );
      return [];
    }
  }

  /**
   * Process a manufacturer to get latest aircraft data
   * @param manufacturer Manufacturer name
   */
  public async processManufacturer(manufacturer: string): Promise<Aircraft[]> {
    // Get tracking state
    let state = this.trackingStates.get(manufacturer);
    if (!state) {
      state = {
        activeIcao24s: new Set(),
        pendingIcao24s: new Set(),
        lastUpdate: 0,
        isTracking: false,
        pollingInterval: null,
      };
      this.trackingStates.set(manufacturer, state);
    }

    try {
      // Get all ICAO24s for this manufacturer if we don't have any yet
      if (state.pendingIcao24s.size === 0) {
        // Try to fetch ICAO24s from base class implementation or static data
        const icao24s = await super.getManufacturerIcao24s(manufacturer);
        if (icao24s && icao24s.length > 0) {
          state.pendingIcao24s = new Set(icao24s);
        }
      }

      // Convert Sets to arrays for processing
      const pendingArray = Array.from(state.pendingIcao24s);
      const activeArray = Array.from(state.activeIcao24s);

      // Process pending ICAO24s first (in batches if needed)
      if (pendingArray.length > 0) {
        const batchSize = this.rateLimiter.batchSize || 100;

        for (let i = 0; i < pendingArray.length; i += batchSize) {
          const batch = pendingArray.slice(i, i + batchSize);
          await this.processIcao24Batch(batch, manufacturer);
        }
      }

      // Then process active ICAO24s
      if (activeArray.length > 0) {
        const batchSize = this.rateLimiter.batchSize || 100;

        for (let i = 0; i < activeArray.length; i += batchSize) {
          const batch = activeArray.slice(i, i + batchSize);
          await this.processIcao24Batch(batch, manufacturer);
        }
      }

      // Get all tracked aircraft for this manufacturer from the position service
      // This would be implemented in your actual code to retrieve aircraft from your tracking database
      // For now, creating dummy aircraft objects from the ICAO24s we have
      const allIcao24s = new Set([
        ...state.activeIcao24s,
        ...state.pendingIcao24s,
      ]);
      const aircraftList: Aircraft[] = Array.from(allIcao24s).map((icao24) => ({
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
        altitude: 0,
        velocity: 0,
        heading: 0,
        on_ground: false,
        isTracked: true,
        last_contact: Math.floor(Date.now() / 1000),
      }));

      // Notify subscribers
      this.notifySubscribers(manufacturer, aircraftList);

      return aircraftList;
    } catch (error: unknown) {
      console.error(
        `[ManufacturerTrackingService] Error processing ${manufacturer}:`,
        error
      );
      this.handleError(error);

      // Return empty array on error
      return [];
    }
  }

  /**
   * Process a batch of ICAO24 codes
   * @param icao24s Array of ICAO24 codes
   * @param manufacturer Manufacturer name
   */
  private async processIcao24Batch(
    icao24s: string[],
    manufacturer: string
  ): Promise<number> {
    if (!icao24s.length) return 0;

    try {
      // Get OpenSky data for these ICAO24s
      const openSkyData = await this.fetchOpenSkyData(icao24s, manufacturer);

      if (openSkyData.length > 0) {
        // Update positions
        const updatedCount = await this.updateAircraftPositions(
          openSkyData,
          manufacturer
        );

        // Update tracking state
        const state = this.trackingStates.get(manufacturer);
        if (state) {
          // Move from pending to active if positions were found
          const updatedIcao24s = openSkyData.map((state) => state[0]);

          updatedIcao24s.forEach((icao24) => {
            state.pendingIcao24s.delete(icao24);
            state.activeIcao24s.add(icao24);
          });

          state.lastUpdate = Date.now();
        }

        return updatedCount;
      }

      return 0;
    } catch (error) {
      console.error(
        `[ManufacturerTrackingService] Error processing ICAO24 batch:`,
        error
      );
      throw error;
    }
  }

  /**
   * Update aircraft positions
   * @param positions OpenSky state arrays
   * @param manufacturer Manufacturer name
   */
  public async updateAircraftPositions(
    positions: OpenSkyStateArray[],
    manufacturer: string
  ): Promise<number> {
    if (!positions.length) return 0;

    try {
      // Use the position service to update
      return await aircraftPositionService.updatePositions(
        positions,
        manufacturer
      );
    } catch (error) {
      console.error(
        '[ManufacturerTrackingService] Error updating positions:',
        error
      );
      return 0;
    }
  }

  /**
   * Convert AircraftRecord to Aircraft
   * @param record AircraftRecord to convert
   */
  private recordToAircraft(record: AircraftRecord): Aircraft {
    return {
      icao24: record.icao24,
      'N-NUMBER': record['N-NUMBER'] || '',
      manufacturer: record.manufacturer || '',
      model: record.model || '',
      operator: record.operator || '',
      NAME: record.NAME || '',
      CITY: record.CITY || '',
      STATE: record.STATE || '',
      OWNER_TYPE: record.OWNER_TYPE || '',
      TYPE_AIRCRAFT: record.TYPE_AIRCRAFT || '',
      latitude: 0,
      longitude: 0,
      altitude: 0,
      velocity: 0,
      heading: 0,
      on_ground: false,
      isTracked: true,
      last_contact: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Clean up stale aircraft for a manufacturer
   * @param manufacturer Manufacturer name
   * @param olderThan Remove aircraft older than this time (in ms, default: 1 hour)
   */
  public async cleanupManufacturer(
    manufacturer: string,
    olderThan: number = 60 * 60 * 1000
  ): Promise<{
    trackedRemoved: number;
    pendingRemoved: number;
  }> {
    const state = this.trackingStates.get(manufacturer);
    if (!state) {
      return { trackedRemoved: 0, pendingRemoved: 0 };
    }

    const now = Date.now();
    const cutoff = now - olderThan;

    // Nothing to do if last update is newer than cutoff
    if (state.lastUpdate > cutoff) {
      return { trackedRemoved: 0, pendingRemoved: 0 };
    }

    try {
      // Clear pending aircraft
      const pendingRemoved = state.pendingIcao24s.size;
      state.pendingIcao24s.clear();

      // Since we don't have direct access to a database,
      // we'll just clear all active aircraft older than the cutoff time
      // In a real implementation, this would involve a database call

      // For now, we'll simulate by removing all active aircraft
      const trackedRemoved = state.activeIcao24s.size;
      state.activeIcao24s.clear();

      return { trackedRemoved, pendingRemoved };
    } catch (error) {
      console.error('[ManufacturerTrackingService] Error cleaning up:', error);
      return { trackedRemoved: 0, pendingRemoved: 0 };
    }
  }

  /**
   * Cleanup method required by BaseTrackingService
   */
  public destroy(): void {
    // Stop all tracking
    for (const manufacturer of this.trackingStates.keys()) {
      this.stopTracking(manufacturer);
    }

    // Clear tracking states
    this.trackingStates.clear();

    // Clear subscriptions
    this.subscriptions.clear();
  }
}

// Export singleton instance
export const manufacturerTracking = ManufacturerTrackingService.getInstance();
