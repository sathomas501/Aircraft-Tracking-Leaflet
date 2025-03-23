// lib/services/OpenSkyTrackingService.ts

import { ExtendedAircraft, Aircraft, SelectOption } from '@/types/base';
import { AircraftModel } from '@/types/aircraft-models';

// Track active requests to prevent duplicate calls
const activeRequests: Map<string, Promise<any>> = new Map();

// Cache tracking data with TTL
interface TrackingCache {
  data: any;
  timestamp: number;
  ttl: number;
}
const trackingCache: Map<string, TrackingCache> = new Map();

async function processBatchedRequests<T, R>(
  items: T[],
  batchProcessor: (batch: T[]) => Promise<R[]>,
  batchSize: number
): Promise<R[]> {
  // Initialize results as empty array
  let allResults: R[] = [];

  // Create batches
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  console.log(`Processing ${items.length} items in ${batches.length} batches`);

  // Process each batch sequentially
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    try {
      console.log(
        `Processing batch ${i + 1}/${batches.length} (${batch.length} items)`
      );
      const batchResult = await batchProcessor(batch);

      // Make sure batchResult is an array before spreading
      if (Array.isArray(batchResult)) {
        allResults = [...allResults, ...batchResult];
      } else {
        console.warn(`Batch ${i + 1} returned non-array result. Skipping.`);
      }

      console.log(
        `Batch ${i + 1} complete, got ${Array.isArray(batchResult) ? batchResult.length : 0} results`
      );
    } catch (error) {
      console.error(`Error processing batch ${i + 1}:`, error);
      // Continue with next batch
    }
  }

  return allResults;
}

// In your openSkyTrackingService.js
let preventBoundsFit = false;

// Add a function to call when starting a refresh
interface SetRefreshInProgress {
  (inProgress: boolean): void;
}

const setRefreshInProgress: SetRefreshInProgress = (inProgress) => {
  preventBoundsFit = inProgress;
  // Expose this to window for immediate access
  if (typeof window !== 'undefined') {
    (window as any).__preventMapBoundsFit = inProgress;
  }
  console.log('Setting preventBoundsFit to', inProgress);
};

// Call this at start/end of your refresh operations

/**
 * Service for interacting with OpenSky tracking data
 */
class OpenSkyTrackingService {
  private static instance: OpenSkyTrackingService;
  private pendingRefresh: boolean = false;
  private refreshInterval: NodeJS.Timeout | null = null;
  private currentManufacturer: string | null = null;
  private subscribers = new Set<(data: any) => void>();
  private loading: boolean = false; // Add this property

  // Tracking state
  private trackingActive = false;
  private trackedAircraft: Aircraft[] = [];
  private lastRefreshTime: number = 0;
  private modelStats: Map<string, { active: number; total: number }> =
    new Map();

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): OpenSkyTrackingService {
    if (!OpenSkyTrackingService.instance) {
      OpenSkyTrackingService.instance = new OpenSkyTrackingService();
    }
    return OpenSkyTrackingService.instance;
  }

  public isLoading(): boolean {
    return this.loading;
  }
  /**
   * Subscribe to tracking updates
   */
  public subscribe(callback: (data: any) => void): () => void {
    this.subscribers.add(callback);

    // Immediately call with current data if available
    if (this.trackedAircraft.length > 0) {
      callback({
        aircraft: this.trackedAircraft,
        manufacturer: this.currentManufacturer,
        timestamp: this.lastRefreshTime,
      });
    }

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  public subscribeToAircraft(
    callback: (aircraft: Aircraft[]) => void
  ): () => void {
    this.subscribers.add(callback);

    // Immediately call with current data if available
    if (this.trackedAircraft.length > 0) {
      callback(this.trackedAircraft);
    }

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  public subscribeToStatus(callback: (status: string) => void): () => void {
    const statusCallback = () =>
      callback(this.trackingActive ? 'Tracking Active' : 'Not Tracking');
    this.subscribers.add(statusCallback);

    // Immediately notify with current status
    statusCallback();

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(statusCallback);
    };
  }

  /**
   * Manually refresh tracking data
   */
  public async refreshNow(): Promise<void> {
    if (!this.trackingActive || !this.currentManufacturer) {
      console.warn(
        '[OpenSky] No active tracking session. Start tracking first.'
      );
      return;
    }

    console.log('[OpenSky] Manually refreshing aircraft data...');
    this.pendingRefresh = true;

    try {
      await this.fetchAndUpdateAircraft(this.currentManufacturer);
    } catch (error) {
      console.error('[OpenSky] Error refreshing aircraft data:', error);
    } finally {
      this.pendingRefresh = false;
    }
  }

  /**
   * Start tracking a manufacturer's aircraft
   */
  public async trackManufacturer(manufacturer: string): Promise<Aircraft[]> {
    if (this.trackingActive && this.currentManufacturer === manufacturer) {
      console.log(`[OpenSky] Already tracking ${manufacturer}`);
      return this.trackedAircraft;
    }

    // Stop any existing tracking
    this.stopTracking();

    if (!manufacturer) {
      return [];
    }

    console.log(`[OpenSky] Starting tracking for ${manufacturer}`);
    this.currentManufacturer = manufacturer;
    this.trackingActive = true;

    // Initial fetch
    await this.fetchAndUpdateAircraft(manufacturer);

    // Remove auto-refresh; refresh will now be triggered manually
    console.log(
      `[OpenSky] Tracking started for ${manufacturer}, manual refresh required.`
    );

    return this.trackedAircraft;
  }

  // Update this whenever aircraft data changes
  private updateModelStats(): void {
    // Clear previous stats
    this.modelStats.clear();

    // Count total aircraft by model from the database or cached data
    // This would need to be populated when you first fetch the model list

    // Count active aircraft by model from currently tracked aircraft
    this.trackedAircraft.forEach((aircraft) => {
      const model = aircraft.model || aircraft.TYPE_AIRCRAFT;
      if (!model) return;

      if (!this.modelStats.has(model)) {
        this.modelStats.set(model, { active: 0, total: 0 });
      }

      const stats = this.modelStats.get(model)!;
      stats.active += 1;
    });
  }

  /**
   * Get active model counts for currently tracked aircraft
   */
  public getActiveModelCounts(): AircraftModel[] {
    // Count active aircraft by model
    const modelCounts = new Map<string, number>();

    this.trackedAircraft.forEach((aircraft) => {
      const model = aircraft.model || aircraft.TYPE_AIRCRAFT || 'Unknown';
      const currentCount = modelCounts.get(model) || 0;
      modelCounts.set(model, currentCount + 1);
    });

    // Convert to array of AircraftModel objects
    return Array.from(modelCounts.entries()).map(([model, count]) => ({
      model,
      label: model, // Required by AircraftModel
      count: count,
      activeCount: count,
      totalCount: count,
      // Ensure manufacturer is always a string
      manufacturer: this.currentManufacturer || 'Unknown',
    }));
  }

  /**
   * Get model statistics
   */
  public getModelStats(): {
    models: AircraftModel[];
    totalActive: number;
  } {
    const models = this.getActiveModelCounts();
    const totalActive = this.trackedAircraft.length;

    return { models, totalActive };
  }
  /**
   * Stop tracking aircraft
   */
  public stopTracking(): void {
    console.log('[OpenSky] Stopping tracking');
    this.trackingActive = false;
    this.currentManufacturer = null;

    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    this.trackedAircraft = [];
    this.notifySubscribers();
  }

  /**
   * Fetch aircraft data
   */
  private async fetchAndUpdateAircraft(manufacturer: string): Promise<void> {
    try {
      console.log(`[OpenSky] Fetching aircraft for ${manufacturer}`);

      // First get ICAO codes for this manufacturer
      const icao24s = await this.getIcao24sForManufacturer(manufacturer);

      if (icao24s.length === 0) {
        console.log(`[OpenSky] No ICAO codes found for ${manufacturer}`);
        this.trackedAircraft = [];
        this.notifySubscribers();
        return;
      }

      // Then get live tracking data for these ICAO codes
      const liveAircraft = await this.getLiveAircraftData(
        manufacturer,
        icao24s
      );

      // Update tracked aircraft and notify subscribers
      this.trackedAircraft = liveAircraft;
      this.lastRefreshTime = Date.now();
      this.notifySubscribers();

      console.log(
        `[OpenSky] Updated tracking data for ${manufacturer}: ${liveAircraft.length} aircraft`
      );
    } catch (error) {
      console.error(
        `[OpenSky] Error fetching aircraft for ${manufacturer}:`,
        error
      );
    }
  }

  /**
   * Get ICAO24 codes for a manufacturer
   */
  private async getIcao24sForManufacturer(
    manufacturer: string
  ): Promise<string[]> {
    const requestKey = `icao24s-${manufacturer}`;
    if (activeRequests.has(requestKey)) {
      console.log(
        `[OpenSky] Using existing ICAO24s request for ${manufacturer}`
      );
      return activeRequests.get(requestKey)!;
    }

    const request = new Promise<string[]>(async (resolve, reject) => {
      try {
        console.log(`[OpenSky] Fetching ICAO24s for ${manufacturer}`);

        const response = await fetch('/api/aircraft/icao24s', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ manufacturer }),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch ICAO24s: ${response.statusText}`);
        }

        const data = await response.json();
        resolve(data.icao24s || []);
      } catch (error) {
        console.error(
          `[OpenSky] Error fetching ICAO24s for ${manufacturer}:`,
          error
        );
        reject(error);
      }
    });

    activeRequests.set(requestKey, request);
    return request;
  }

  public getExtendedAircraft(modelFilter?: string): ExtendedAircraft[] {
    let filtered = this.trackedAircraft;

    // Apply model filter if provided
    if (modelFilter) {
      filtered = filtered.filter(
        (aircraft) =>
          aircraft.model === modelFilter ||
          aircraft.TYPE_AIRCRAFT === modelFilter
      );
    }

    // Transform to extended aircraft
    return filtered.map((aircraft) => ({
      ...aircraft,
      type: aircraft.TYPE_AIRCRAFT || 'Unknown',
      isGovernment:
        aircraft.operator?.toLowerCase().includes('government') ?? false,
    })) as ExtendedAircraft[];
  }

  private async getLiveAircraftData(
    manufacturer: string,
    icao24s: string[]
  ): Promise<Aircraft[]> {
    const cacheKey = `live-${manufacturer}`;

    // Check cache first
    const cached = trackingCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      console.log(`[OpenSky] Using cached live data for ${manufacturer}`);
      return cached.data;
    }

    // Check if request is already in progress
    if (activeRequests.has(cacheKey)) {
      console.log(
        `[OpenSky] Using existing live data request for ${manufacturer}`
      );
      try {
        return await activeRequests.get(cacheKey)!;
      } catch (error) {
        console.error(`[OpenSky] Error from existing request:`, error);
        activeRequests.delete(cacheKey);
      }
    }

    // Create a separate function for the actual data fetching
    const fetchData = async (): Promise<Aircraft[]> => {
      try {
        const BATCH_SIZE = 900;
        console.log(`[OpenSky] Fetching live aircraft data in batches...`);

        // Process batches without using Promise.race
        const aircraftResults = await processBatchedRequests<string, Aircraft>(
          icao24s,
          async (batch) => {
            try {
              const response = await fetch('/api/tracking/live', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  manufacturer,
                  icao24s: batch,
                  includeStatic: true,
                }),
              });

              if (!response.ok) {
                throw new Error(
                  `Failed to fetch live data: ${response.status} ${response.statusText}`
                );
              }

              const data = await response.json();
              if (!data || !Array.isArray(data.aircraft)) {
                console.warn('[OpenSky] Unexpected response format:', data);
                return [];
              }

              return data.aircraft || [];
            } catch (fetchError) {
              console.error('[OpenSky] Batch fetch error:', fetchError);
              return []; // Return empty array for this batch
            }
          },
          BATCH_SIZE
        );

        // Cache the result
        trackingCache.set(cacheKey, {
          data: aircraftResults,
          timestamp: Date.now(),
          ttl: 20000, // 20 seconds
        });

        return aircraftResults;
      } catch (error) {
        console.error(`[OpenSky] Error fetching live aircraft data:`, error);
        return []; // Return empty array on error
      }
    };

    // Create request promise and add timeout separately
    let timeoutId: NodeJS.Timeout;

    const requestPromise = new Promise<Aircraft[]>((resolve) => {
      // Set a timeout to resolve with empty array after 60 seconds
      timeoutId = setTimeout(() => {
        console.warn('[OpenSky] Request timed out after 60 seconds');
        resolve([]);
      }, 60000);

      // Execute the fetch
      fetchData().then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      });
    });

    // Store the request
    activeRequests.set(cacheKey, requestPromise);

    try {
      // Wait for the request to complete
      const result = await requestPromise;
      return result;
    } finally {
      // Always clean up
      activeRequests.delete(cacheKey);
    }
  }

  /**
   * Notify all subscribers of changes
   */
  private notifySubscribers(): void {
    const data = {
      aircraft: this.trackedAircraft,
      manufacturer: this.currentManufacturer,
      count: this.trackedAircraft.length,
      timestamp: this.lastRefreshTime,
    };

    this.subscribers.forEach((callback) => callback(data));
  }

  // In OpenSkyTrackingService.ts

  /**
   * Manually refresh only position data for currently tracked aircraft
   * without re-fetching ICAO codes from the database
   */

  /**
   * Force a refresh of tracking data
   */
  public async refreshTracking(): Promise<void> {
    if (!this.trackingActive || !this.currentManufacturer) {
      return;
    }

    await this.fetchAndUpdateAircraft(this.currentManufacturer);
  }

  /**
   * Get currently tracked aircraft
   */
  public getTrackedAircraft(): Aircraft[] {
    return this.trackedAircraft;
  }

  /**
   * Check if tracking is active
   */
  public isTrackingActive(): boolean {
    return this.trackingActive;
  }

  /**
   * Get currently tracked manufacturer
   */
  public getCurrentManufacturer(): string | null {
    return this.currentManufacturer;
  }

  /**
   * This should be called after any tracking update to ensure model counts are current
   */
  private updateTrackedAircraftState(): void {
    // Update last refresh time
    this.lastRefreshTime = Date.now();

    // Notify subscribers about the updated aircraft
    this.notifySubscribers();

    console.log(
      `[OpenSky] Updated tracking data: ${this.trackedAircraft.length} aircraft, ` +
        `${this.getActiveModelCounts().length} unique models`
    );
  }

  /**
   * Update this method to call updateTrackedAircraftState
   */
  private isRefreshingPositions = false;

  public async refreshPositionsOnly(): Promise<Aircraft[]> {
    if (this.isRefreshingPositions) {
      console.log('Already refreshing positions, skipping');
      return this.trackedAircraft;
    }

    this.isRefreshingPositions = true; // Set flag to true
    // Use the setRefreshInProgress function instead of directly setting window property
    setRefreshInProgress(true);
    console.log('[OpenSky] Refreshing positions only for tracked aircraft');

    this.loading = true;
    const refreshStartTime = Date.now(); // Track when we started

    try {
      // Get the ICAO codes of currently tracked aircraft
      const activeIcaos = this.trackedAircraft
        .map((aircraft) => aircraft.icao24)
        .filter((icao) => icao); // Filter out any undefined

      if (activeIcaos.length === 0) {
        console.log('[OpenSky] No active aircraft to refresh');
        return [];
      }

      // Only get live data for these aircraft without re-fetching from database
      const updatedAircraft = await this.getLiveAircraftData(
        this.currentManufacturer ?? '', // Use empty string as fallback if null
        activeIcaos
      );

      // Update tracked aircraft
      this.trackedAircraft = updatedAircraft;

      // Update state and notify subscribers
      this.updateTrackedAircraftState();

      console.log(
        `[OpenSky] Refreshed positions for ${updatedAircraft.length} aircraft`
      );
      return updatedAircraft;
    } catch (error) {
      console.error('[OpenSky] Error refreshing positions:', error);
      return this.trackedAircraft; // Return current data on error
    } finally {
      this.loading = false;
      this.isRefreshingPositions = false; // Reset the flag in finally block

      // Make sure we don't reset too quickly (ensure at least 500ms passed)
      const elapsedTime = Date.now() - refreshStartTime;
      const resetDelay = Math.max(0, 500 - elapsedTime);

      // Reset the prevent bounds fit flag after a delay
      setTimeout(() => {
        setRefreshInProgress(false); // Use the function instead of direct assignment
      }, resetDelay + 500); // Add a bit more buffer time
    }
  }
}

// Export singleton instance
const openSkyTrackingService = OpenSkyTrackingService.getInstance();
export default openSkyTrackingService;
export { setRefreshInProgress };
