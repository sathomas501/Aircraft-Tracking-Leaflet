import { BaseTrackingService } from './base-tracking-service';
import { Aircraft, OpenSkyStateArray } from '@/types/base';
import { aircraftPositionService } from './aircraft-position-service';

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
        const allIcao24s = new Set([...state.activeIcao24s]);
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
