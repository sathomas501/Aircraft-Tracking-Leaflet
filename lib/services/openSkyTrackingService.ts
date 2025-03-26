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

// Define a trail interface to store position history
interface AircraftPosition {
  latitude: number;
  longitude: number;
  altitude: number | null;
  timestamp: number;
}

interface AircraftTrail {
  icao24: string;
  positions: AircraftPosition[];
  maxPositions: number; // Maximum trail length
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
  private trails: Map<string, AircraftTrail> = new Map();
  private trailsEnabled: boolean = false;
  private maxTrailLength: number = 10; // Default trail length
  private trackedIcao24s: Set<string> = new Set();
  private lastFullRefreshTime: number = 0;
  private fullRefreshInterval: number = 3600000;
  private activeIcao24s: Set<string> = new Set();
  private activeAircraftIds: Set<string> = new Set();
  private lastActiveRefreshTime: number = 0;

  private updateTrackedIcao24sSet(): void {
    // Clear the current set
    this.trackedIcao24s.clear();

    // Add all valid ICAO24 codes from tracked aircraft
    this.trackedAircraft.forEach((aircraft) => {
      if (aircraft.icao24) {
        this.trackedIcao24s.add(aircraft.icao24);
      }
    });

    console.log(
      `[OpenSky] Updated tracked ICAO24s set: ${this.trackedIcao24s.size} aircraft`
    );
  }

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

  public getTrackedIcao24s(): string[] {
    return Array.from(this.trackedIcao24s);
  }

  public isAircraftTracked(icao24: string): boolean {
    return this.trackedIcao24s.has(icao24);
  }
  /**
   * Enable or disable aircraft trails
   */
  public setTrailsEnabled(enabled: boolean): void {
    this.trailsEnabled = enabled;

    // Clear trails if disabling
    if (!enabled) {
      this.trails.clear();
      this.notifySubscribers();
    }

    console.log(
      `[OpenSky] Aircraft trails ${enabled ? 'enabled' : 'disabled'}`
    );
  }

  /**
   * Check if trails are enabled
   */
  public areTrailsEnabled(): boolean {
    return this.trailsEnabled;
  }

  /**
   * Set maximum trail length (number of positions to store)
   */
  public setMaxTrailLength(length: number): void {
    this.maxTrailLength = Math.max(2, Math.min(50, length)); // Clamp between 2 and 50

    // Update existing trails to match new length
    this.trails.forEach((trail) => {
      trail.maxPositions = this.maxTrailLength;
      if (trail.positions.length > this.maxTrailLength) {
        trail.positions = trail.positions.slice(-this.maxTrailLength);
      }
    });

    this.notifySubscribers();
    console.log(
      `[OpenSky] Trail length set to ${this.maxTrailLength} positions`
    );
  }

  /**
   * Get maximum trail length
   */
  public getMaxTrailLength(): number {
    return this.maxTrailLength;
  }

  /**
   * Update aircraft trails based on current position data
   */
  private updateTrails(): void {
    if (!this.trailsEnabled) return;

    console.log('[OpenSky] Updating aircraft trails...');
    const currentTime = Date.now();
    let totalUpdates = 0;

    // Update trails for each aircraft
    this.trackedAircraft.forEach((aircraft) => {
      if (!aircraft.icao24 || !aircraft.latitude || !aircraft.longitude) return;

      const icao = aircraft.icao24.toLowerCase();

      // Get or create trail for this aircraft
      let trail = this.trails.get(icao);
      if (!trail) {
        trail = {
          icao24: icao,
          positions: [],
          maxPositions: this.maxTrailLength,
        };
        this.trails.set(icao, trail);
      }

      // Check if this is a new position worth adding
      const lastPos = trail.positions[trail.positions.length - 1];

      // Consider adding a new point if:
      // 1. There's no previous position
      // 2. The position has changed significantly
      // 3. It's been more than 30 seconds since the last update
      const timeSinceLastUpdate = lastPos
        ? currentTime - lastPos.timestamp
        : Infinity;
      const positionChanged =
        !lastPos ||
        Math.abs(lastPos.latitude - aircraft.latitude) > 0.0001 ||
        Math.abs(lastPos.longitude - aircraft.longitude) > 0.0001;
      const altitudeChanged =
        lastPos &&
        aircraft.altitude &&
        Math.abs((lastPos.altitude || 0) - aircraft.altitude) > 100;

      if (
        !lastPos ||
        positionChanged ||
        altitudeChanged ||
        timeSinceLastUpdate > 30000
      ) {
        // Add new position
        trail.positions.push({
          latitude: aircraft.latitude,
          longitude: aircraft.longitude,
          altitude: aircraft.altitude || null,
          timestamp: currentTime,
        });

        totalUpdates++;

        // Keep trail at max length
        if (trail.positions.length > trail.maxPositions) {
          trail.positions = trail.positions.slice(-trail.maxPositions);
        }
      }
    });

    // Clean up trails for aircraft no longer tracked
    const trackedIcaos = new Set(
      this.trackedAircraft.map((a) => a.icao24?.toLowerCase()).filter(Boolean)
    );

    let removed = 0;
    for (const icao of this.trails.keys()) {
      if (!trackedIcaos.has(icao)) {
        this.trails.delete(icao);
        removed++;
      }
    }

    console.log(
      `[OpenSky] Trail updates: ${totalUpdates} positions added, ${removed} stale trails removed`
    );
  }

  /**
   * Get trail for a specific aircraft
   */
  public getAircraftTrails(icao24: string): AircraftPosition[] {
    return this.trails.get(icao24)?.positions || [];
  }

  /**
   * Get all aircraft trails
   */
  public getAllTrails(): Map<string, AircraftPosition[]> {
    const result = new Map<string, AircraftPosition[]>();

    if (!this.trailsEnabled) {
      return result; // Return empty map if trails are disabled
    }

    // Convert from our internal trail format to the expected output format
    this.trails.forEach((trail, icao24) => {
      // Only include trails with at least 2 positions (needed to draw a line)
      if (trail.positions.length >= 2) {
        result.set(icao24, [...trail.positions]); // Ensure we return a copy
      }
    });

    console.log(`[OpenSky] Providing ${result.size} trails with data`);
    return result;
  }

  public generateMockTrails(): void {
    if (!this.trailsEnabled) {
      console.log(
        '[OpenSky] Trails are disabled, enable them before generating mock data'
      );
      return;
    }

    console.log('[OpenSky] Generating mock trail data for testing...');
    const now = Date.now();
    let count = 0;

    this.trackedAircraft.forEach((aircraft) => {
      if (!aircraft.icao24 || !aircraft.latitude || !aircraft.longitude) return;

      const icao = aircraft.icao24.toLowerCase();
      const trail: AircraftPosition[] = [];

      // Generate a trail that goes back in time from the current position
      for (let i = 0; i < this.maxTrailLength; i++) {
        // Create a position slightly offset from the current one
        // to simulate movement in a consistent direction
        const timeOffset = i * 10000; // 10 seconds between points
        const latOffset = i * 0.001 * Math.cos(aircraft.heading || 0);
        const lonOffset = i * 0.001 * Math.sin(aircraft.heading || 0);

        trail.push({
          latitude: aircraft.latitude - latOffset,
          longitude: aircraft.longitude - lonOffset,
          altitude: aircraft.altitude,
          timestamp: now - timeOffset,
        });
      }

      // Sort by timestamp ascending (oldest first)
      trail.sort((a, b) => a.timestamp - b.timestamp);

      // Store the mock trail
      this.trails.set(icao, {
        icao24: icao,
        positions: trail,
        maxPositions: this.maxTrailLength,
      });

      count++;
    });

    console.log(`[OpenSky] Generated mock trails for ${count} aircraft`);
    this.notifySubscribers(); // Notify subscribers about the new trail data
  }

  /**
   * Force generate trails for all tracked aircraft.
   * This creates visible trails even if the normal trail collection process isn't working.
   */
  public forceGenerateTrails(): void {
    if (!this.trackingActive) {
      console.log(
        '[OpenSky] No active tracking session. Start tracking first.'
      );
      return;
    }

    // Make sure trails are enabled
    if (!this.trailsEnabled) {
      this.setTrailsEnabled(true);
      console.log('[OpenSky] Trails were disabled, enabling them now');
    }

    console.log('[OpenSky] Forcing trail generation for active aircraft...');

    const now = Date.now();
    let count = 0;

    // Clear existing trails to avoid conflicts
    this.trails.clear();

    // Create mock trails for all aircraft
    this.trackedAircraft.forEach((aircraft) => {
      if (!aircraft.icao24 || !aircraft.latitude || !aircraft.longitude) return;

      const positions: AircraftPosition[] = [];
      const icao = aircraft.icao24.toLowerCase();

      // Generate trail points
      for (let i = 0; i < this.maxTrailLength; i++) {
        // Create points in a line based on heading
        const heading = aircraft.heading || 0; // Default to 0 if undefined
        const angleRad = (heading - 180) * (Math.PI / 180); // Convert to radians, reverse direction

        // Calculate position offset based on index
        const stepSize = 0.0005; // Adjust for longer/shorter trails
        const latOffset = Math.cos(angleRad) * stepSize * i;
        const lonOffset = Math.sin(angleRad) * stepSize * i;

        positions.push({
          latitude: aircraft.latitude + latOffset,
          longitude: aircraft.longitude + lonOffset,
          altitude: aircraft.altitude,
          timestamp: now - i * 30000, // 30 seconds between points
        });
      }

      // Store the trail - use AircraftTrail interface format
      this.trails.set(icao, {
        icao24: icao,
        positions: positions,
        maxPositions: this.maxTrailLength,
      });

      count++;
    });

    console.log(`[OpenSky] Generated trails for ${count} aircraft`);

    // Notify subscribers
    this.notifySubscribers();
  }

  /**
   * Refresh specific aircraft by ICAO24 codes
   */
  // In OpenSkyTrackingService.ts
  public async refreshSpecificAircraft(icao24s: string[]): Promise<Aircraft[]> {
    if (this.isRefreshingPositions) {
      return this.trackedAircraft;
    }

    this.isRefreshingPositions = true;

    try {
      if (!this.currentManufacturer || icao24s.length === 0) {
        return this.trackedAircraft;
      }

      // Simple implementation - just get data for specific aircraft
      const updatedAircraft = await this.getLiveAircraftData(
        this.currentManufacturer,
        icao24s,
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

    // Clear active set
    this.activeIcao24s.clear();

    // Initial fetch
    await this.fetchAndUpdateAircraft(manufacturer);

    // Initialize our active aircraft set
    this.updateActiveAircraftSet(this.trackedAircraft);

    // Set the initial full refresh time
    this.lastFullRefreshTime = Date.now();

    console.log(
      `[OpenSky] Tracking started for ${manufacturer}, ${this.trackedAircraft.length} aircraft`
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
    this.activeIcao24s.clear(); // Clear active set
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
        this.trackedIcao24s.clear(); // Clear tracking set
        this.notifySubscribers();
        return;
      }

      // Then get live tracking data for these ICAO codes
      const liveAircraft = await this.getLiveAircraftData(
        manufacturer,
        icao24s
      );

      this.updateTrails();

      // Update tracked aircraft and notify subscribers
      this.trackedAircraft = liveAircraft;
      this.updateTrackedIcao24sSet(); // Update our tracking set
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
   * Helper method to get current state of tracking
   */
  public getTrackingStatus(): {
    active: boolean;
    manufacturer: string | null;
    count: number;
    lastRefresh: number;
  } {
    return {
      active: this.trackingActive,
      manufacturer: this.currentManufacturer,
      count: this.trackedAircraft.length,
      lastRefresh: this.lastRefreshTime,
    };
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

        const response = await fetch('/api/tracking/icao24s', {
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
    icao24s: string[],
    includeStatic: boolean = true,
    activeOnly: boolean = false // Add this parameter
  ): Promise<Aircraft[]> {
    // Generate a more specific cache key that includes whether this is a position-only update
    const cacheKey = `live-${manufacturer}-${includeStatic ? 'full' : 'pos'}-${icao24s.length}`;

    // Check cache first
    const cached = trackingCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      console.log(
        `[OpenSky] Using cached data for ${manufacturer} (${icao24s.length} aircraft)`
      );
      return cached.data;
    }

    // Check if request is already in progress
    if (activeRequests.has(cacheKey)) {
      console.log(`[OpenSky] Using existing request for ${manufacturer}`);
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
        const BATCH_SIZE = 100; // Smaller batch size for more responsive updates
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
                  includeStatic,
                  activeOnly, // Add this parameter
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

        // Shorter cache TTL for position-only updates to keep data fresh
        const ttl = includeStatic ? 20000 : 10000; // 20s for full data, 10s for positions only

        // Cache the result
        trackingCache.set(cacheKey, {
          data: aircraftResults,
          timestamp: Date.now(),
          ttl,
        });

        return aircraftResults;
      } catch (error) {
        console.error(`[OpenSky] Error fetching live aircraft data:`, error);
        return []; // Return empty array on error
      }
    };

    // Create request promise with timeout
    let timeoutId: NodeJS.Timeout;

    const requestPromise = new Promise<Aircraft[]>((resolve) => {
      // Shorter timeout for position-only updates
      const timeoutDuration = includeStatic ? 60000 : 30000; // 60s for full data, 30s for positions

      // Set a timeout to resolve with empty array after timeout duration
      timeoutId = setTimeout(() => {
        console.warn(
          `[OpenSky] Request timed out after ${timeoutDuration / 1000} seconds`
        );
        resolve([]);
      }, timeoutDuration);

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
    // Prepare the trail data only if trails are enabled
    const trailData = this.trailsEnabled ? this.getAllTrails() : null;

    const data = {
      aircraft: this.trackedAircraft,
      manufacturer: this.currentManufacturer,
      count: this.trackedAircraft.length,
      timestamp: this.lastRefreshTime,
      trails: trailData, // This is now properly formatted for components
    };

    // Log trail data to help with debugging
    if (trailData) {
      console.log(
        `[OpenSky] Notifying subscribers with ${trailData.size} trails`
      );
      if (trailData.size > 0) {
        // Log information about the first trail as a sample
        const firstIcao = Array.from(trailData.keys())[0];
        const firstTrail = trailData.get(firstIcao);
        console.log(
          `[OpenSky] Sample trail for ${firstIcao}: ${firstTrail?.length} positions`
        );
      }
    }

    this.subscribers.forEach((callback) => callback(data));
  }

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

  /**
   * Enhanced refreshPositionsOnly method with periodic full refresh
   */
  public async refreshPositionsOnly(): Promise<Aircraft[]> {
    if (this.isRefreshingPositions) {
      console.log('[OpenSky] Already refreshing positions, skipping');
      return this.trackedAircraft;
    }

    // If we're not tracking anything, there's nothing to refresh
    if (!this.trackingActive || !this.currentManufacturer) {
      console.log('[OpenSky] No active tracking or manufacturer to refresh');
      return this.trackedAircraft;
    }

    this.isRefreshingPositions = true;
    setRefreshInProgress(true);
    this.loading = true;
    const refreshStartTime = Date.now(); // Define refreshStartTime

    try {
      // Check if we should do a full refresh or just active aircraft
      const shouldDoFullRefresh =
        this.activeIcao24s.size === 0 ||
        Date.now() - this.lastFullRefreshTime > 3600000; // 1 hour

      // Store manufacturer as a non-null variable to satisfy TypeScript
      const manufacturer = this.currentManufacturer;

      if (shouldDoFullRefresh) {
        console.log(
          '[OpenSky] Performing full refresh to discover active aircraft'
        );

        // First, get all ICAO24 codes for the manufacturer
        const allIcao24s = await this.getIcao24sForManufacturer(manufacturer);

        // Then get live data, but only for aircraft with position data
        const updatedAircraft = await this.getLiveAircraftData(
          manufacturer,
          allIcao24s,
          true, // includeStatic
          true // activeOnly
        );

        // Update the set of active aircraft
        this.activeIcao24s.clear();
        updatedAircraft.forEach((aircraft) => {
          if (aircraft.icao24) {
            this.activeIcao24s.add(aircraft.icao24.toLowerCase());
          }
        });

        this.lastFullRefreshTime = Date.now();

        // Update tracked aircraft
        this.trackedAircraft = updatedAircraft;
        this.updateTrails();
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
          manufacturer, // Using non-null manufacturer
          activeIcaos,
          false, // No need for static data during position updates
          true // activeOnly - ensure we only get aircraft with position data
        );

        // Update the set of active aircraft to remove any that are no longer active
        this.activeIcao24s.clear();
        updatedAircraft.forEach((aircraft) => {
          if (aircraft.icao24) {
            this.activeIcao24s.add(aircraft.icao24.toLowerCase());
          }
        });

        // Update tracked aircraft
        this.trackedAircraft = updatedAircraft;
        this.updateTrails();
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
   * Get position updates for specific ICAO24 codes
   * This method makes a focused API request for just position data
   */
  private async getPositionUpdates(icao24s: string[]): Promise<Aircraft[]> {
    const cacheKey = `positions-${icao24s.length}`;

    // Check if request is already in progress
    if (activeRequests.has(cacheKey)) {
      console.log('[OpenSky] Using existing position update request');
      try {
        return await activeRequests.get(cacheKey)!;
      } catch (error) {
        console.error('[OpenSky] Error from existing position request:', error);
        activeRequests.delete(cacheKey);
      }
    }

    // Function to fetch the position data
    const fetchPositions = async (): Promise<Aircraft[]> => {
      try {
        const BATCH_SIZE = 100; // Smaller batch size for position-only updates
        console.log(`[OpenSky] Fetching position updates in batches...`);

        // Process batches
        const positionResults = await processBatchedRequests<string, Aircraft>(
          icao24s,
          async (batch) => {
            try {
              // Use a dedicated endpoint for position-only updates
              const response = await fetch('/api/tracking/positions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  icao24s: batch,
                }),
              });

              if (!response.ok) {
                throw new Error(
                  `Failed to fetch positions: ${response.status} ${response.statusText}`
                );
              }

              const data = await response.json();
              if (!data || !Array.isArray(data.aircraft)) {
                console.warn(
                  '[OpenSky] Unexpected position response format:',
                  data
                );
                return [];
              }

              return data.aircraft || [];
            } catch (fetchError) {
              console.error(
                '[OpenSky] Batch position fetch error:',
                fetchError
              );
              return [];
            }
          },
          BATCH_SIZE
        );

        return positionResults;
      } catch (error) {
        console.error(`[OpenSky] Error fetching position updates:`, error);
        return [];
      }
    };

    // Create request promise with timeout
    let timeoutId: NodeJS.Timeout;

    const requestPromise = new Promise<Aircraft[]>((resolve) => {
      // Set a timeout to resolve with empty array after 30 seconds
      // Position-only updates should be faster, so we use a shorter timeout
      timeoutId = setTimeout(() => {
        console.warn(
          '[OpenSky] Position update request timed out after 30 seconds'
        );
        resolve([]);
      }, 30000);

      // Execute the fetch
      fetchPositions().then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      });
    });

    // Store the request
    activeRequests.set(cacheKey, requestPromise);

    try {
      // Wait for the request to complete
      return await requestPromise;
    } finally {
      // Always clean up
      activeRequests.delete(cacheKey);
    }
  }

  /**
   * Updates the set of active aircraft based on position data
   */
  private updateActiveAircraftSet(aircraft: Aircraft[]): void {
    aircraft.forEach((plane) => {
      if (plane.icao24 && plane.latitude && plane.longitude) {
        this.activeIcao24s.add(plane.icao24.toLowerCase());
      }
    });

    console.log(
      `[OpenSky] Active aircraft set has ${this.activeIcao24s.size} aircraft`
    );
  }

  /**
   * Removes aircraft from active set if they no longer have position data
   */
  private pruneInactiveAircraft(
    requestedIcaos: string[],
    receivedAircraft: Aircraft[]
  ): void {
    const receivedIcaos = new Set<string>();
    receivedAircraft.forEach((aircraft) => {
      if (aircraft.icao24 && aircraft.latitude && aircraft.longitude) {
        receivedIcaos.add(aircraft.icao24.toLowerCase());
      }
    });

    let removedCount = 0;
    requestedIcaos.forEach((icao) => {
      if (!receivedIcaos.has(icao.toLowerCase())) {
        this.activeIcao24s.delete(icao.toLowerCase());
        removedCount++;
      }
    });

    if (removedCount > 0) {
      console.log(`[OpenSky] Removed ${removedCount} aircraft from active set`);
    }
  }

  /**
   * Merges position updates with existing aircraft data
   */
  private mergePositionUpdates(positionUpdates: Aircraft[]): void {
    const positionMap = new Map<string, Aircraft>();
    positionUpdates.forEach((aircraft) => {
      if (aircraft.icao24) {
        positionMap.set(aircraft.icao24.toLowerCase(), aircraft);
      }
    });

    let updatedCount = 0;

    this.trackedAircraft = this.trackedAircraft.map((aircraft) => {
      if (!aircraft.icao24) return aircraft;

      const icao = aircraft.icao24.toLowerCase();
      const positionUpdate = positionMap.get(icao);

      if (
        positionUpdate &&
        positionUpdate.latitude &&
        positionUpdate.longitude
      ) {
        updatedCount++;
        return {
          ...aircraft,
          latitude: positionUpdate.latitude,
          longitude: positionUpdate.longitude,
          altitude: positionUpdate.altitude,
          velocity: positionUpdate.velocity,
          heading: positionUpdate.heading,
          on_ground: positionUpdate.on_ground,
          lastSeen: positionUpdate.lastSeen || Date.now(),
        };
      }

      return aircraft;
    });

    console.log(`[OpenSky] Updated positions for ${updatedCount} aircraft`);
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
