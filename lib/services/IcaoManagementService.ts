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

/**
 * Service for managing ICAO24 codes
 */
class IcaoManagementService {
  private static BATCH_SIZE = 900; // Keep below SQLite's limit

  public constructor() {}

  /**
   * Fetch ICAO24s for a MANUFACTURER, directly from the database.
   */
  public async getIcao24sForManufacturer(
    MANUFACTURER: string
  ): Promise<string[]> {
    console.log(`[IcaoManagement] Fetching ICAO24s for ${MANUFACTURER}`);

    try {
      // Get ICAO24 codes directly from the database instead of making an API call
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
   * Clear the response cache
   */
  public clearCache(): void {
    responseCache.clear();
    console.log('[ICAO24] Cache cleared');
  }
}

export default new IcaoManagementService();
