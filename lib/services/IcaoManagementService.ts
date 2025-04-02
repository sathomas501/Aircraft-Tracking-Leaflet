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
   * Fetch ICAO24s for a MANUFACTURER, directly from the database.
   */
  public async getIcao24sForManufacturer(
    MANUFACTURER: string
  ): Promise<string[]> {
    console.log(`[IcaoManagement] Fetching ICAO24s for ${MANUFACTURER}`);

    try {
      // Get ICAO codes directly from the database instead of making an API call
      const allIcao24s =
        await dbManager.getIcao24sForManufacturer(MANUFACTURER);

      if (allIcao24s.length === 0) {
        console.warn(`[IcaoManagement] No ICAO24s found for ${MANUFACTURER}`);
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
   * Fetch live aircraft data for a batch of ICAOs
   */
  private async fetchLiveAircraftBatch(
    icaos: string[],
    MANUFACTURER: string
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
          ICAO24s: icaos,
          MANUFACTURER,
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
   * Clear the response cache
   */
  public clearCache(): void {
    responseCache.clear();
    console.log('[ICAO] Cache cleared');
  }
}

export default new IcaoManagementService();
