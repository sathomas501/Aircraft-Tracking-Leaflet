// lib/services/IcaoManagementService.ts

import { Aircraft } from '@/types/base';
import dbManager from '../db/DatabaseManager';
import { API_CONFIG } from '@/config/api';

// Constants
const MAX_ICAO_PER_REQUEST = 100; // OpenSky limit
const OPENSKY_PROXY_URL = '/api/proxy/opensky';
const CACHE_TTL = 15000; // 15 seconds cache
const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

// Cache for OpenSky responses
const responseCache = new Map<string, { data: any; timestamp: number }>();

// Track active requests to prevent duplicates
const activeRequests = new Map<string, Promise<Aircraft[]>>();

/**
 * Service for managing ICAO codes and fetching aircraft data
 */
class IcaoManagementService {
  private static BATCH_SIZE = 900; // Keep below SQLite's limit
  private activeIcao24s: Set<string> = new Set();
  private lastFullRefreshTime: number = 0;

  public constructor() {}

  /**
   * Full refresh interval in milliseconds (default: 1 hour)
   */
  private fullRefreshInterval: number = 3600000;

  /**
   * Flag to enable/disable optimization
   */
  private useOptimization: boolean = true;

  /**
   * Update the set of active aircraft based on live data
   */
  public updateActiveAircraftSet(aircraft: Aircraft[]): void {
    let newCount = 0;

    // Find aircraft with position data
    aircraft.forEach((plane) => {
      if (plane.icao24 && plane.latitude && plane.longitude) {
        if (!this.activeIcao24s.has(plane.icao24.toLowerCase())) {
          newCount++;
        }
        this.activeIcao24s.add(plane.icao24.toLowerCase());
      }
    });

    console.log(
      `[ICAO] Active aircraft set updated: ${this.activeIcao24s.size} total (${newCount} new)`
    );
  }

  /**
   * Get array of active ICAO24 codes
   */
  public getActiveIcao24s(): string[] {
    return Array.from(this.activeIcao24s);
  }

  /**
   * Set the optimization state
   */
  public setOptimization(enabled: boolean): void {
    this.useOptimization = enabled;
    console.log(`[ICAO] Optimization ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set the full refresh interval
   */
  public setFullRefreshInterval(minutes: number): void {
    const minMinutes = 10;
    const validMinutes = Math.max(minMinutes, minutes);
    this.fullRefreshInterval = validMinutes * 60 * 1000;
    console.log(`[ICAO] Full refresh interval set to ${validMinutes} minutes`);
  }

  /**
   * Optimized method to track aircraft with intelligent refresh strategy
   */
  public async trackAircraftOptimized(
    manufacturer: string,
    forceFullRefresh: boolean = false
  ): Promise<Aircraft[]> {
    console.log(`[ICAO] Starting optimized tracking for ${manufacturer}`);

    // Determine if we need a full refresh
    const timeSinceFullRefresh = Date.now() - this.lastFullRefreshTime;
    const needsFullRefresh =
      forceFullRefresh ||
      !this.useOptimization ||
      this.activeIcao24s.size === 0 ||
      timeSinceFullRefresh >= this.fullRefreshInterval;

    let results: Aircraft[] = [];

    if (needsFullRefresh) {
      // Perform a full refresh to discover all aircraft
      console.log(`[ICAO] Performing full refresh for ${manufacturer}`);

      // Get all ICAO24 codes for this manufacturer
      const allIcao24s = await this.getIcao24sForManufacturer(manufacturer);
      console.log(
        `[ICAO] Found ${allIcao24s.length} total ICAO24s for ${manufacturer}`
      );

      // Track all aircraft to get position data
      results = await this.trackAircraft(allIcao24s, manufacturer);

      // Update our set of active aircraft
      this.updateActiveAircraftSet(results);

      // Update the full refresh timestamp
      this.lastFullRefreshTime = Date.now();

      console.log(
        `[ICAO] Full refresh complete. Found ${results.length} aircraft with position data`
      );
    } else {
      // Perform an optimized refresh for only active aircraft
      const activeIcaos = this.getActiveIcao24s();
      console.log(
        `[ICAO] Performing optimized refresh for ${activeIcaos.length} active aircraft`
      );

      // Only request data for active aircraft
      results = await this.trackAircraft(activeIcaos, manufacturer);

      // Update our active aircraft set (some may have become inactive)
      this.updateActiveAircraftSet(results);

      console.log(
        `[ICAO] Optimized refresh complete. Found ${results.length} aircraft with position data`
      );
    }

    return results;
  }

  /**
   * Clear active aircraft set and caches
   */
  public resetTracking(): void {
    this.activeIcao24s.clear();
    this.lastFullRefreshTime = 0;
    this.clearCache();
    console.log('[ICAO] Tracking reset');
  }

  public async refreshActivePositions(
    manufacturer: string
  ): Promise<Aircraft[]> {
    if (this.activeIcao24s.size === 0) {
      console.log('[ICAO] No active aircraft to refresh');
      return [];
    }

    const activeIcaos = Array.from(this.activeIcao24s);
    console.log(
      `[ICAO] Refreshing positions for ${activeIcaos.length} active aircraft`
    );

    return this.trackAircraft(activeIcaos, manufacturer);
  }
  /**
   * Fetch ICAO24s for a manufacturer, directly from the database.
   */
  public async getIcao24sForManufacturer(
    manufacturer: string
  ): Promise<string[]> {
    console.log(`[IcaoManagement] Fetching ICAO24s for ${manufacturer}`);

    try {
      // Get ICAO codes directly from the database instead of making an API call
      const allIcao24s =
        await dbManager.getIcao24sForManufacturer(manufacturer);

      if (allIcao24s.length === 0) {
        console.warn(`[IcaoManagement] No ICAO24s found for ${manufacturer}`);
        return [];
      }

      // Process in batches
      return this.processBatchedRequests(allIcao24s, async (batch) => batch);
    } catch (error) {
      console.error(`[IcaoManagement] Error fetching ICAO24s:`, error);
      return [];
    }
  }

  /**
   * Generic function to process large lists in batches.
   */
  private async processBatchedRequests<T>(
    items: T[],
    batchProcessor: (batch: T[]) => Promise<any>
  ): Promise<T[]> {
    let results: T[] = [];
    for (let i = 0; i < items.length; i += IcaoManagementService.BATCH_SIZE) {
      const batch = items.slice(i, i + IcaoManagementService.BATCH_SIZE);
      try {
        const batchResult = await batchProcessor(batch);
        results = results.concat(batchResult);
      } catch (error) {
        console.error(`[IcaoManagement] Batch processing error:`, error);
      }
    }
    return results;
  }

  /**
   * Process tracking for a list of ICAO codes
   * Returns live aircraft with static data merged
   */
  public async trackAircraft(
    icaos: string[],
    manufacturer: string
  ): Promise<Aircraft[]> {
    // Validate and normalize ICAOs
    const validIcaos = this.validateIcaos(icaos);

    if (validIcaos.length === 0) {
      console.log('[ICAO] No valid ICAOs to track');
      return [];
    }

    // Create a request key based on ICAOs
    const requestKey = JSON.stringify(validIcaos.sort());

    // Check if this request is already in progress
    if (activeRequests.has(requestKey)) {
      console.log('[ICAO] Using existing request for these ICAOs');
      return activeRequests.get(requestKey)!;
    }

    // Create a new request
    const requestPromise = this.processIcaoBatches(validIcaos, manufacturer);
    activeRequests.set(requestKey, requestPromise);

    // Clean up after request completes
    requestPromise.finally(() => {
      setTimeout(() => {
        activeRequests.delete(requestKey);
      }, 1000);
    });

    return requestPromise;
  }

  /**
   * Process ICAO batches and fetch live data
   */
  private async processIcaoBatches(
    icaos: string[],
    manufacturer: string
  ): Promise<Aircraft[]> {
    console.log(
      `[ICAO] Processing ${icaos.length} ICAOs in batches (limit: ${MAX_ICAO_PER_REQUEST})`
    );

    // Split ICAOs into batches
    const batches: string[][] = [];
    for (let i = 0; i < icaos.length; i += MAX_ICAO_PER_REQUEST) {
      batches.push(icaos.slice(i, i + MAX_ICAO_PER_REQUEST));
    }

    console.log(`[ICAO] Processing ${batches.length} batches`);

    // Fetch all static aircraft data in one go
    const staticAircraft = await dbManager.getAircraftByIcao24s(icaos);

    // Create a lookup map of static data by ICAO
    const staticDataMap = new Map();
    staticAircraft.forEach((aircraft) => {
      if (aircraft.icao24) {
        staticDataMap.set(aircraft.icao24.toLowerCase(), aircraft);
      }
    });

    console.log(
      `[ICAO] Loaded ${staticAircraft.length} static aircraft records`
    );

    // Process batches sequentially to respect rate limits
    const allAircraft: Aircraft[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(
        `[ICAO] Processing batch ${i + 1}/${batches.length} with ${batch.length} ICAOs`
      );

      try {
        const batchAircraft = await this.fetchLiveAircraftBatch(
          batch,
          manufacturer
        );

        // Merge with static data
        const mergedAircraft = batchAircraft.map((liveAircraft) => {
          const icao = liveAircraft.icao24.toLowerCase();
          const staticData = staticDataMap.get(icao) || {};

          return {
            ...staticData, // Static aircraft data from database
            ...liveAircraft, // Live position data from OpenSky
            icao24: icao, // Ensure consistent icao24 format
            manufacturer: staticData.manufacturer || manufacturer, // Ensure manufacturer
            isTracked: true, // Mark as tracked
            lastSeen: Date.now(), // Update last seen timestamp
          };
        });

        allAircraft.push(...mergedAircraft);
        console.log(
          `[ICAO] Batch ${i + 1} processed, found ${mergedAircraft.length} active aircraft`
        );

        // Small delay between batches to avoid overwhelming the API
        if (i < batches.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`[ICAO] Error processing batch ${i + 1}:`, error);
      }
    }

    console.log(
      `[ICAO] Completed processing, found ${allAircraft.length} active aircraft`
    );
    return allAircraft;
  }

  /**
   * Fetch live aircraft data for a batch of ICAOs
   */
  private async fetchLiveAircraftBatch(
    icaos: string[],
    manufacturer: string
  ): Promise<Aircraft[]> {
    const batchKey = JSON.stringify(icaos.sort());

    // Check cache for recent data
    const cached = responseCache.get(batchKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[ICAO] Using cached data for ${icaos.length} ICAOs`);
      return cached.data;
    }

    try {
      console.log(
        `[ICAO] Fetching live data for ${icaos.length} ICAOs from OpenSky proxy`
      );

      // Add request timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        API_CONFIG.TIMEOUT?.DEFAULT || 20000
      );

      // Request live data from OpenSky proxy
      const response = await fetch(OPENSKY_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          icao24s: icaos,
          manufacturer,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `OpenSky proxy error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Unknown error from OpenSky proxy');
      }

      const aircraft = data.data?.states || [];
      console.log(`[ICAO] Received ${aircraft.length} aircraft from OpenSky`);

      // Cache the results
      responseCache.set(batchKey, {
        data: aircraft,
        timestamp: Date.now(),
      });

      return aircraft;
    } catch (error) {
      console.error(`[ICAO] Error fetching live data:`, error);

      // Return empty array on error
      return [];
    }
  }

  /**
   * Validate and normalize ICAO codes
   */
  private validateIcaos(icaos: string[]): string[] {
    if (!Array.isArray(icaos)) {
      return [];
    }

    // Create a Set to remove duplicates
    const icaoSet = new Set<string>();

    icaos.forEach((icao) => {
      if (typeof icao === 'string') {
        const normalized = icao.trim().toLowerCase();

        // Only include valid ICAO codes (6 hex characters)
        if (/^[0-9a-f]{6}$/.test(normalized)) {
          icaoSet.add(normalized);
        }
      }
    });

    return Array.from(icaoSet);
  }

  /**
   * Clear the response cache
   */
  public clearCache(): void {
    responseCache.clear();
    console.log('[ICAO] Cache cleared');
  }
}

export default new IcaoManagementService();
