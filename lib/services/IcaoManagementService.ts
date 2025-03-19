// lib/services/IcaoManagementService.ts

import { Aircraft } from '@/types/base';
import dbManager from '../db/DatabaseManager';
import { API_CONFIG } from '@/config/api';

// Constants
const MAX_ICAO_PER_REQUEST = 100; // OpenSky limit
const OPENSKY_PROXY_URL = '/api/proxy/opensky';
const CACHE_TTL = 15000; // 15 seconds cache

// Cache for OpenSky responses
const responseCache = new Map<string, { data: any; timestamp: number }>();

// Track active requests to prevent duplicates
const activeRequests = new Map<string, Promise<Aircraft[]>>();

/**
 * Service for managing ICAO codes and fetching aircraft data
 */
class IcaoManagementService {
  private static instance: IcaoManagementService;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): IcaoManagementService {
    if (!IcaoManagementService.instance) {
      IcaoManagementService.instance = new IcaoManagementService();
    }
    return IcaoManagementService.instance;
  }

  /**
   * Fetch ICAO codes for a manufacturer from the database
   */
  public async getIcaosByManufacturer(manufacturer: string): Promise<string[]> {
    try {
      console.log(`[ICAO] Fetching ICAOs for ${manufacturer}`);
      const cacheKey = `manufacturer-icaos-${manufacturer}`;

      // Query with caching
      const query = `
        SELECT DISTINCT icao24
        FROM aircraft
        WHERE manufacturer = ?
        AND icao24 IS NOT NULL AND icao24 != ''
        AND LENGTH(icao24) = 6
        ORDER BY icao24
      `;

      const results = await dbManager.query<{ icao24: string }>(
        cacheKey,
        query,
        [manufacturer],
        600 // 10 minute cache
      );

      // Validate ICAO codes
      const validIcaos = results
        .map((item) => item.icao24.toLowerCase())
        .filter((icao) => /^[0-9a-f]{6}$/.test(icao));

      console.log(
        `[ICAO] Found ${validIcaos.length} valid ICAOs for ${manufacturer}`
      );
      return validIcaos;
    } catch (error) {
      console.error(`[ICAO] Error fetching ICAOs for ${manufacturer}:`, error);
      return [];
    }
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

// Export a singleton instance
const icaoService = IcaoManagementService.getInstance();
export default icaoService;
