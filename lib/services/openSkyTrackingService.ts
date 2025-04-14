// lib/services/OpenSkyTrackingService.ts

import { Aircraft, SelectOption } from '../../types/base';
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

// Define a trail interface to store position history
interface AircraftPosition {
  latitude: number;
  longitude: number;
  altitude: number | null;
  timestamp: number;
}

// Add this at the top of your file, with the other variables
let blockAllApiCalls = false;

interface ExtendedAircraft extends Aircraft, CachedAircraftData {}

interface CachedAircraftData {
  markerData?: any;
  popupData?: any;
  tooltipData?: any;
  // Other cache-specific fields can go here
}

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

  private trackedIcao24s: Set<string> = new Set();
  private lastFullRefreshTime: number = 0;
  private fullRefreshInterval: number = 3600000;
  private activeIcao24s: Set<string> = new Set();

  private persistentAircraftCache: Map<string, ExtendedAircraft> = new Map();

  private updateTrackedIcao24sSet(): void {
    // Clear the current set
    this.trackedIcao24s.clear();

    // Add all valid ICAO24 codes from tracked aircraft
    this.trackedAircraft.forEach((aircraft) => {
      if (aircraft.ICAO24) {
        this.trackedIcao24s.add(aircraft.ICAO24);
      }
    });

    console.log(
      `[OpenSky] Updated tracked ICAO24s set: ${this.trackedIcao24s.size} aircraft`
    );
  }

  private constructor() {}

  /**
   * Block or unblock all API calls
   */
  public setBlockAllApiCalls(block: boolean): boolean {
    console.log(`[OpenSky] ${block ? 'Blocking' : 'Unblocking'} all API calls`);
    blockAllApiCalls = block;
    return blockAllApiCalls;
  }

  /**
   * Get current block status
   */
  public isApiCallsBlocked(): boolean {
    return blockAllApiCalls;
  }

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
        MANUFACTURER: this.currentManufacturer,
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

  public getTrackedIcao24s(): string[] {
    return Array.from(this.trackedIcao24s);
  }

  public isAircraftTracked(ICAO24: string): boolean {
    return this.trackedIcao24s.has(ICAO24);
  }

  /**
   * Refresh specific aircraft by ICAO24 codes
   */
  // In OpenSkyTrackingService.ts
  public async refreshSpecificAircraft(ICAO24s: string[]): Promise<Aircraft[]> {
    if (this.isRefreshingPositions) {
      return this.trackedAircraft;
    }

    this.isRefreshingPositions = true;

    try {
      if (!this.currentManufacturer || ICAO24s.length === 0) {
        return this.trackedAircraft;
      }

      // Simple implementation - just get data for specific aircraft
      const updatedAircraft = await this.getLiveAircraftData(
        this.currentManufacturer,
        ICAO24s,
        false
      );

      // Update tracked aircraft
      this.trackedAircraft = updatedAircraft;

      // Notify subscribers
      this.notifySubscribers();

      return this.trackedAircraft;
    } catch (error) {
      return this.trackedAircraft;
    } finally {
      this.isRefreshingPositions = false;
    }
  }

  /**
   * Start tracking a MANUFACTURER's aircraft
   */
  public async trackManufacturer(MANUFACTURER: string): Promise<Aircraft[]> {
    // Check block flag first
    if (blockAllApiCalls) {
      console.log(
        `[OpenSky] API calls blocked - skipping tracking for ${MANUFACTURER}`
      );
      return []; // Return empty array instead of undefined
    }

    if (this.trackingActive && this.currentManufacturer === MANUFACTURER) {
      console.log(`[OpenSky] Already tracking ${MANUFACTURER}`);
      return this.trackedAircraft;
    }

    // Stop any existing tracking
    this.stopTracking();

    if (!MANUFACTURER) {
      return [];
    }

    console.log(`[OpenSky] Starting tracking for ${MANUFACTURER}`);
    this.currentManufacturer = MANUFACTURER;
    this.trackingActive = true;

    // Clear active set
    this.activeIcao24s.clear();

    // Initial fetch
    await this.fetchAndUpdateAircraft(MANUFACTURER);

    // Initialize our active aircraft set
    this.updateActiveAircraftSet(this.trackedAircraft);

    // Set the initial full refresh time
    this.lastFullRefreshTime = Date.now();

    console.log(
      `[OpenSky] Tracking started for ${MANUFACTURER}, ${this.trackedAircraft.length} aircraft`
    );

    return this.trackedAircraft;
  }

  public getRefreshStats(): {
    lastRefreshTime: number;
    lastFullRefreshTime: number;
    nextFullRefreshDue: number;
    fullRefreshInterval: number;
    trackedAircraftCount: number;
  } {
    const nextFullRefreshDue =
      this.lastFullRefreshTime + this.fullRefreshInterval;
    const minutesUntilNextFull = Math.max(
      0,
      Math.floor((nextFullRefreshDue - Date.now()) / 60000)
    );

    return {
      lastRefreshTime: this.lastRefreshTime,
      lastFullRefreshTime: this.lastFullRefreshTime,
      nextFullRefreshDue: nextFullRefreshDue,
      fullRefreshInterval: this.fullRefreshInterval,
      trackedAircraftCount: this.trackedAircraft.length,
    };
  }

  /**
   * Get active MODEL counts for currently tracked aircraft
   */
  public getActiveModelCounts(): AircraftModel[] {
    // Count active aircraft by MODEL
    const modelCounts = new Map<string, number>();

    this.trackedAircraft.forEach((aircraft) => {
      const MODEL = aircraft.MODEL || aircraft.TYPE_AIRCRAFT || 'Unknown';
      const currentCount = modelCounts.get(MODEL) || 0;
      modelCounts.set(MODEL, currentCount + 1);
    });

    // Convert to array of AircraftModel objects
    return Array.from(modelCounts.entries()).map(([MODEL, count]) => ({
      MODEL,
      label: MODEL, // Required by AircraftModel
      count: count,
      activeCount: count,
      totalCount: count,
      // Ensure MANUFACTURER is always a string
      MANUFACTURER: this.currentManufacturer || 'Unknown',
    }));
  }

  /**
   * Get MODEL statistics
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
  // Clear cache when stopping tracking
  public stopTracking(): void {
    console.log('[OpenSky] Stopping tracking');
    this.trackingActive = false;
    this.currentManufacturer = null;

    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    this.trackedAircraft = [];
    this.activeIcao24s.clear(); // Clear active set
    this.persistentAircraftCache.clear(); // Clear the persistent cache
    this.notifySubscribers();
  }

  /**
   * Fetch aircraft data
   */
  private async fetchAndUpdateAircraft(MANUFACTURER: string): Promise<void> {
    // Check block flag first
    if (blockAllApiCalls) {
      console.log(
        `[OpenSky] API calls blocked - skipping fetch for ${MANUFACTURER}`
      );
      return; // Just return without a value for void return type
    }

    try {
      console.log(`[OpenSky] Fetching aircraft for ${MANUFACTURER}`);

      // First get ICAO24 codes for this MANUFACTURER
      const ICAO24s = await this.getIcao24sForManufacturer(MANUFACTURER);

      if (ICAO24s.length === 0) {
        console.log(`[OpenSky] No ICAO24 codes found for ${MANUFACTURER}`);
        this.trackedAircraft = [];
        this.trackedIcao24s.clear(); // Clear tracking set
        this.notifySubscribers();
        return;
      }

      // Then get live tracking data for these ICAO24 codes
      const liveAircraft = await this.getLiveAircraftData(
        MANUFACTURER,
        ICAO24s
      );

      // Update tracked aircraft and notify subscribers
      this.trackedAircraft = liveAircraft;
      this.updateTrackedIcao24sSet(); // Update our tracking set
      this.lastRefreshTime = Date.now();
      this.notifySubscribers();

      console.log(
        `[OpenSky] Updated tracking data for ${MANUFACTURER}: ${liveAircraft.length} aircraft`
      );
    } catch (error) {
      console.error(
        `[OpenSky] Error fetching aircraft for ${MANUFACTURER}:`,
        error
      );
    }
  }

  /**
   * Helper method to get current state of tracking
   */
  public getTrackingStatus(): {
    active: boolean;
    MANUFACTURER: string | null;
    count: number;
    lastRefresh: number;
  } {
    return {
      active: this.trackingActive,
      MANUFACTURER: this.currentManufacturer,
      count: this.trackedAircraft.length,
      lastRefresh: this.lastRefreshTime,
    };
  }

  /**
   * Get ICAO24 codes for a MANUFACTURER
   */
  private async getIcao24sForManufacturer(
    MANUFACTURER: string
  ): Promise<string[]> {
    // Check block flag first
    if (blockAllApiCalls) {
      console.log(
        `[OpenSky] API calls blocked - skipping ICAO24 fetch for ${MANUFACTURER}`
      );
      return []; // Return empty array instead of undefined
    }

    const requestKey = `ICAO24s-${MANUFACTURER}`;
    if (activeRequests.has(requestKey)) {
      console.log(
        `[OpenSky] Using existing ICAO24s request for ${MANUFACTURER}`
      );
      return activeRequests.get(requestKey)!;
    }

    const request = new Promise<string[]>(async (resolve, reject) => {
      try {
        console.log(`[OpenSky] Fetching ICAO24s for ${MANUFACTURER}`);

        const response = await fetch('/api/tracking/ICAO24s', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ MANUFACTURER }),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch ICAO24s: ${response.statusText}`);
        }

        const data = await response.json();
        resolve(data.ICAO24s || []);
      } catch (error) {
        console.error(
          `[OpenSky] Error fetching ICAO24s for ${MANUFACTURER}:`,
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

    // Apply MODEL filter if provided
    if (modelFilter) {
      filtered = filtered.filter(
        (aircraft) =>
          aircraft.MODEL === modelFilter ||
          aircraft.TYPE_AIRCRAFT === modelFilter
      );
    }

    // Transform to extended aircraft
    return filtered.map((aircraft) => ({
      ...aircraft,
      type: aircraft.TYPE_AIRCRAFT || 'Unknown',
      isGovernment:
        aircraft.OPERATOR?.toLowerCase().includes('government') ?? false,
    })) as ExtendedAircraft[];
  }

  private async getLiveAircraftData(
    MANUFACTURER: string,
    ICAO24s: string[],
    includeStatic: boolean = true,
    activeOnly: boolean = false
  ): Promise<Aircraft[]> {
    // Check block flag first
    if (blockAllApiCalls) {
      console.log(`[OpenSky] API calls blocked - skipping operation`);
      return []; // Or appropriate return value
    }
    // Keep your existing method code but modify the part where you process results
    const cacheKey = `live-${MANUFACTURER}-${includeStatic ? 'full' : 'pos'}-${ICAO24s.length}`;
    // ... existing code ...

    // Modify your existing fetchData function or add this processing after you get the results
    const fetchDataWithCaching = async (): Promise<Aircraft[]> => {
      try {
        // Use your existing code to fetch data
        const BATCH_SIZE = 100;
        console.log(`[OpenSky] Fetching live aircraft data in batches...`);

        // Process batches without using Promise.race
        const aircraftResults = await processBatchedRequests<string, Aircraft>(
          ICAO24s,
          async (batch) => {
            try {
              const response = await fetch('/api/tracking/live', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  MANUFACTURER,
                  ICAO24s: batch,
                  includeStatic,
                  activeOnly,
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

        // Process the returned aircraft and merge with cached data
        const processedAircraft = aircraftResults.map((aircraft: Aircraft) => {
          if (!aircraft.ICAO24) return aircraft;

          const icao = aircraft.ICAO24.toLowerCase();
          const cachedAircraft = this.persistentAircraftCache.get(icao);

          if (cachedAircraft) {
            // Merge new data with cached data, prioritizing new position data
            const mergedAircraft = {
              ...cachedAircraft, // Start with cached data
              ...aircraft, // Apply new aircraft data
              // Ensure any special fields from cache are preserved
              // TypeScript will now recognize these properties from our ExtendedAircraft interface
              markerData: cachedAircraft.markerData,
              popupData: cachedAircraft.popupData,
              tooltipData: cachedAircraft.tooltipData,
            } as ExtendedAircraft;

            // Update cache
            this.persistentAircraftCache.set(icao, mergedAircraft);

            return mergedAircraft;
          }

          // No cached data, store this aircraft in the cache
          const extendedAircraft = aircraft as ExtendedAircraft;
          this.persistentAircraftCache.set(icao, extendedAircraft);
          return extendedAircraft;
        });

        // Cache the result
        const ttl = includeStatic ? 20000 : 10000; // 20s for full data, 10s for positions only
        trackingCache.set(cacheKey, {
          data: processedAircraft,
          timestamp: Date.now(),
          ttl,
        });

        return processedAircraft;
      } catch (error) {
        console.error(`[OpenSky] Error fetching live aircraft data:`, error);

        // On error, return cached data if available
        if (this.persistentAircraftCache.size > 0) {
          console.log(
            `[OpenSky] Returning ${this.persistentAircraftCache.size} cached aircraft on error`
          );
          return Array.from(this.persistentAircraftCache.values());
        }

        return []; // Return empty array on error with no cache
      }
    };

    // Replace your existing fetchData function with fetchDataWithCaching
    // or call it after your existing fetchData function

    // Use an approach similar to your existing code
    let timeoutId: NodeJS.Timeout;

    const requestPromise = new Promise<Aircraft[]>((resolve) => {
      const timeoutDuration = includeStatic ? 60000 : 30000;

      timeoutId = setTimeout(() => {
        console.warn(
          `[OpenSky] Request timed out after ${timeoutDuration / 1000} seconds`
        );
        resolve([]);
      }, timeoutDuration);

      fetchDataWithCaching().then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      });
    });

    activeRequests.set(cacheKey, requestPromise);

    try {
      return await requestPromise;
    } finally {
      activeRequests.delete(cacheKey);
    }
  }
  /**
   * Notify all subscribers of changes
   */
  private notifySubscribers(): void {
    // Prepare the trail data only if trails are enabled

    const data = {
      aircraft: this.trackedAircraft,
      MANUFACTURER: this.currentManufacturer,
      count: this.trackedAircraft.length,
      timestamp: this.lastRefreshTime,
    };

    this.subscribers.forEach((callback) => callback(data));
  }

  /**
   * Manually refresh only position data for currently tracked aircraft
   * without re-fetching ICAO24 codes from the database
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
   * Get currently tracked MANUFACTURER
   */
  public getCurrentManufacturer(): string | null {
    return this.currentManufacturer;
  }

  /**
   * This should be called after any tracking update to ensure MODEL counts are current
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

  /**
   * Enhanced refreshPositionsOnly method with periodic full refresh
   */
  public async refreshPositionsOnly(): Promise<Aircraft[]> {
    if (this.isRefreshingPositions) {
      console.log('[OpenSky] Already refreshing positions, skipping');
      return this.trackedAircraft;
    }
    // Check block flag first
    if (blockAllApiCalls) {
      console.log(`[OpenSky] API calls blocked - skipping position refresh`);
      return this.trackedAircraft; // Return current aircraft instead of undefined
    }

    // If we're not tracking anything, there's nothing to refresh
    if (!this.trackingActive || !this.currentManufacturer) {
      console.log('[OpenSky] No active tracking or MANUFACTURER to refresh');
      return this.trackedAircraft;
    }

    this.isRefreshingPositions = true;
    setRefreshInProgress(true);
    this.loading = true;
    const refreshStartTime = Date.now();

    try {
      // Check if we should do a full refresh or just active aircraft
      const shouldDoFullRefresh =
        this.activeIcao24s.size === 0 ||
        Date.now() - this.lastFullRefreshTime > 3600000; // 1 hour

      // Store MANUFACTURER as a non-null variable to satisfy TypeScript
      const MANUFACTURER = this.currentManufacturer;

      if (shouldDoFullRefresh) {
        console.log(
          '[OpenSky] Performing full refresh to discover active aircraft'
        );

        // First, get all ICAO24 codes for the MANUFACTURER
        const allIcao24s = await this.getIcao24sForManufacturer(MANUFACTURER);

        // Then get live data, but only for aircraft with position data
        const updatedAircraft = await this.getLiveAircraftData(
          MANUFACTURER,
          allIcao24s,
          true, // includeStatic
          true // activeOnly
        );

        // Update the set of active aircraft
        this.activeIcao24s.clear();
        updatedAircraft.forEach((aircraft) => {
          if (aircraft.ICAO24) {
            this.activeIcao24s.add(aircraft.ICAO24.toLowerCase());
          }
        });

        this.lastFullRefreshTime = Date.now();

        // Update tracked aircraft
        this.trackedAircraft = updatedAircraft;
        this.updateTrackedAircraftState();

        console.log(
          `[OpenSky] Full refresh complete, tracking ${updatedAircraft.length} active aircraft`
        );
        return updatedAircraft;
      } else {
        // Optimized refresh - only get updates for active aircraft
        console.log(
          `[OpenSky] Performing optimized refresh for ${this.activeIcao24s.size} active aircraft`
        );

        const activeIcaos = Array.from(this.activeIcao24s);

        // Only request data for active aircraft
        const updatedAircraft = await this.getLiveAircraftData(
          MANUFACTURER,
          activeIcaos,
          false, // No need for static data during position updates
          true // activeOnly - ensure we only get aircraft with position data
        );

        // Update the set of active aircraft to remove any that are no longer active
        this.activeIcao24s.clear();
        updatedAircraft.forEach((aircraft) => {
          if (aircraft.ICAO24) {
            this.activeIcao24s.add(aircraft.ICAO24.toLowerCase());
          }
        });

        // Update tracked aircraft
        this.trackedAircraft = updatedAircraft;
        this.updateTrackedAircraftState();

        console.log(
          `[OpenSky] Optimized refresh complete, tracking ${updatedAircraft.length} active aircraft`
        );
        return updatedAircraft;
      }
    } catch (error) {
      console.error('[OpenSky] Error refreshing positions:', error);
      return this.trackedAircraft;
    } finally {
      this.loading = false;
      this.isRefreshingPositions = false;

      // Calculate reset delay
      const elapsedTime = Date.now() - refreshStartTime;
      const resetDelay = Math.max(0, 500 - elapsedTime);

      setTimeout(() => {
        setRefreshInProgress(false);
      }, resetDelay + 500);
    }
  }

  /**
   * Updates the set of active aircraft based on position data
   */
  private updateActiveAircraftSet(aircraft: Aircraft[]): void {
    aircraft.forEach((plane) => {
      if (plane.ICAO24 && plane.latitude && plane.longitude) {
        this.activeIcao24s.add(plane.ICAO24.toLowerCase());
      }
    });

    console.log(
      `[OpenSky] Active aircraft set has ${this.activeIcao24s.size} aircraft`
    );
  }

  /**
   * Sets the interval between full refreshes
   */
  public setFullRefreshInterval(minutes: number): void {
    const minMinutes = 10;
    const validMinutes = Math.max(minMinutes, minutes);
    this.fullRefreshInterval = validMinutes * 60 * 1000;
    console.log(
      `[OpenSky] Full refresh interval set to ${validMinutes} minutes`
    );
  }
}

// Export singleton instance
const openSkyTrackingService = OpenSkyTrackingService.getInstance();
export default openSkyTrackingService;
export { setRefreshInProgress };
