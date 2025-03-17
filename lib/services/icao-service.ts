// lib/services/icao24-service.ts
// A centralized service for ICAO24 code management

import { TrackingDatabaseManager } from '@/lib/db/managers/trackingDatabaseManager';
import { Aircraft } from '@/types/base';

export class Icao24Service {
  private static instance: Icao24Service;
  private cache: Map<string, string[]> = new Map();
  private pendingRequests: Map<string, Promise<string[]>> = new Map();
  private CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
  private dbManager!: TrackingDatabaseManager;

  private constructor() {}

  private async initialize() {
    this.dbManager = await TrackingDatabaseManager.getInstance();
  }

  async getAircraft(icao24: string) {
    return await this.dbManager.getAircraftByIcao24(icao24);
  }

  static async create(): Promise<Icao24Service> {
    const service = new Icao24Service();
    await service.initialize(); // Ensure database manager is ready
    return service;
  }

  public static getInstance(): Icao24Service {
    if (!Icao24Service.instance) {
      Icao24Service.instance = new Icao24Service();
    }
    return Icao24Service.instance;
  }

  /**
   * Get ICAO24 codes for a manufacturer
   * This is the primary method that should be used by all other services
   */
  async getManufacturerIcao24s(manufacturer: string): Promise<string[]> {
    if (!manufacturer) {
      console.warn('[Icao24Service] No manufacturer provided');
      return [];
    }

    // Check cache first
    if (this.cache.has(manufacturer)) {
      const cachedData = this.cache.get(manufacturer)!;
      console.log(
        `[Icao24Service] ✅ Using ${cachedData.length} cached ICAO24 codes for ${manufacturer}`
      );
      return cachedData;
    }

    // Check for pending request to avoid duplicate API calls
    if (this.pendingRequests.has(manufacturer)) {
      console.log(
        `[Icao24Service] 🔄 Reusing pending request for ${manufacturer}`
      );
      return this.pendingRequests.get(manufacturer)!;
    }

    // Create new request promise
    const fetchPromise = this.fetchAndCacheIcao24s(manufacturer);
    this.pendingRequests.set(manufacturer, fetchPromise);

    return fetchPromise;
  }

  /**
   * Fetch ICAO24 codes from API and cache the result
   */
  private async fetchAndCacheIcao24s(manufacturer: string): Promise<string[]> {
    try {
      console.log(
        `[Icao24Service] 🔄 Fetching ICAO24 codes for ${manufacturer}`
      );

      // Use the correct API endpoint
      const apiUrl =
        typeof window !== 'undefined'
          ? '/api/aircraft/icao24s' // Client-side
          : `${process.env.NEXT_PUBLIC_API_URL}/api/aircraft/icao24s`; // Server-side

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch ICAO24 codes');
      }

      const icao24List = data.data?.icao24List || [];

      // Cache the result
      this.cache.set(manufacturer, icao24List);

      // Set cache expiration
      setTimeout(() => {
        this.cache.delete(manufacturer);
        console.log(`[Icao24Service] 🗑️ Cache expired for ${manufacturer}`);
      }, this.CACHE_DURATION);

      console.log(
        `[Icao24Service] ✅ Fetched ${icao24List.length} ICAO24 codes for ${manufacturer}`
      );

      return icao24List;
    } catch (error) {
      console.error(`[Icao24Service] ❌ Error fetching ICAO24 codes:`, error);
      return [];
    } finally {
      // Clean up pending request
      this.pendingRequests.delete(manufacturer);
    }
  }

  /**
   * Fetch live aircraft data from OpenSky for given ICAO24 codes
   */
  async fetchLiveAircraft(icao24s: string[]): Promise<Aircraft[]> {
    if (!icao24s || icao24s.length === 0) {
      console.warn('[Icao24Service] ⚠️ No ICAO24s provided');
      return [];
    }

    try {
      console.log(
        `[Icao24Service] 🔄 Requesting live data for ${icao24s.length} ICAOs...`
      );

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/aircraft/icaofetcher`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ icao24s }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `[Icao24Service] ❌ Fetcher API Error: ${response.statusText}`
        );
      }

      const data = await response.json();

      if (data.data && Array.isArray(data.data)) {
        console.log(
          `[Icao24Service] ✅ Received ${data.data.length} aircraft from API`
        );
        return data.data; // Returning fetched aircraft data
      }

      console.warn(`[Icao24Service] ⚠️ No aircraft data received from API`);
      return [];
    } catch (error) {
      console.error('[Icao24Service] ❌ Error fetching live aircraft:', error);
      return [];
    }
  }

  /**
   * Clear the cache for a specific manufacturer or all manufacturers
   */
  clearCache(manufacturer?: string): void {
    if (manufacturer) {
      this.cache.delete(manufacturer);
      console.log(`[Icao24Service] 🗑️ Cleared cache for ${manufacturer}`);
    } else {
      this.cache.clear();
      console.log(`[Icao24Service] 🗑️ Cleared all ICAO24 caches`);
    }
  }
}

// Export singleton instance for convenience
export const icao24Service = Icao24Service.getInstance();
