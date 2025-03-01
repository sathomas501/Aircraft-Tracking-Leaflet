// lib/services/openSkySyncService.ts - Refactored version
import { Aircraft } from '@/types/base';
import UnifiedCacheService from '@/lib/services/managers/unified-cache-system';
import { TrackingDatabaseManager } from '@/lib/db/managers/trackingDatabaseManager';
import { icao24Service } from './icao-service';
import { icao24CacheService } from './icao24Cache';

export class OpenSkySyncService {
  private static instance: OpenSkySyncService;
  private cache: UnifiedCacheService;
  private dbManager: TrackingDatabaseManager | null = null;
  private staticDbManager: any = null; // For static aircraft data
  private currentManufacturer: string = '';

  private constructor() {
    this.cache = UnifiedCacheService.getInstance();
    this.dbManager = TrackingDatabaseManager.getInstance();

    // Ensure `dbManager` is initialized only on the server-side
    if (typeof window === 'undefined') {
      // Also load the static database manager if available
      try {
        this.staticDbManager =
          require('@/lib/db/managers/staticDatabaseManager').default;
      } catch (error) {
        console.error(
          '[OpenSkySyncService] Error loading staticDatabaseManager:',
          error
        );
      }
    }
  }

  public static getInstance(): OpenSkySyncService {
    if (!OpenSkySyncService.instance) {
      OpenSkySyncService.instance = new OpenSkySyncService();
    }
    return OpenSkySyncService.instance;
  }

  /**
   * Get ICAO24 codes for a manufacturer, now using the centralized service
   */
  async getManufacturerIcao24s(manufacturer: string): Promise<string[]> {
    if (!manufacturer) {
      console.warn(
        `[OpenSkySyncService] ⚠️ Manufacturer is required for ICAO24 fetch.`
      );
      return [];
    }

    console.log(
      `[OpenSkySyncService] 🔄 Fetching ICAO24s for manufacturer: ${manufacturer}`
    );

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/aircraft/icao24s`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer }),
      }
    );

    if (!response.ok) {
      console.error(
        `[OpenSkySyncService] ❌ Fetcher API Error: ${response.statusText}`
      );
      return [];
    }

    const data = await response.json();
    return data?.data?.icao24List ?? [];
  }

  /**
   * Fetch live aircraft data for specified ICAO24 codes
   */
  async fetchLiveAircraft(icao24s: string[]): Promise<Aircraft[]> {
    if (!icao24s || icao24s.length === 0) {
      console.warn('[OpenSkySyncService] ⚠️ No ICAO24s provided');
      return [];
    }

    // ✅ Step 1: Check which ICAOs are cached
    const cachedIcaos: string[] =
      await icao24CacheService.getIcao24s('generic');
    const foundIcaos = new Set(cachedIcaos);
    const missingIcaos = icao24s.filter((icao) => !foundIcaos.has(icao));

    if (missingIcaos.length === 0) {
      console.log(
        `[OpenSkySyncService] ✅ All ICAOs are cached, skipping fetch.`
      );
      return [];
    }

    console.log(
      `[OpenSkySyncService] 🔄 Fetching ${missingIcaos.length} missing aircraft from OpenSky...`
    );

    try {
      // ✅ Step 2: Fetch missing ICAO24s from OpenSky
      const newIcao24s: string[] =
        await icao24CacheService.fetchAndCacheIcao24s('generic', async () => {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/aircraft/icao24s`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ manufacturer: 'all' }),
            }
          );

          if (!response.ok) {
            throw new Error(
              `[OpenSkySyncService] ❌ Fetcher API Error: ${response.statusText}`
            );
          }

          const data = await response.json();
          return data?.data?.icao24List ?? []; // ✅ Returns only ICAO24s
        });

      if (newIcao24s.length === 0) {
        console.warn(`[OpenSkySyncService] ⚠️ No new ICAO24s found`);
        return [];
      }

      console.log(
        `[OpenSkySyncService] 🔄 Fetching full aircraft details for ${newIcao24s.length} ICAOs...`
      );

      // ✅ Step 3: Fetch full Aircraft data for new ICAOs
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/aircraft/icaofetcher`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ icao24s: newIcao24s }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `[OpenSkySyncService] ❌ Fetcher API Error: ${response.statusText}`
        );
      }

      const data = await response.json();
      const aircraftList = (data.data ?? []) as Aircraft[];

      console.log(
        `[OpenSkySyncService] ✅ Retrieved ${aircraftList.length} aircraft from OpenSky`
      );

      return aircraftList;
    } catch (error) {
      console.error(
        '[OpenSkySyncService] ❌ Error fetching live aircraft:',
        error
      );
      return [];
    }
  }

  /**
   * Sync a manufacturer's aircraft data
   */
  async syncManufacturer(manufacturer: string): Promise<{
    updated: number;
    total: number;
  }> {
    if (!manufacturer) {
      return { updated: 0, total: 0 };
    }

    try {
      this.currentManufacturer = manufacturer;

      // Step 1: Get ICAO24 codes for this manufacturer (using centralized service)
      const icao24s = (await this.getManufacturerIcao24s(manufacturer)) ?? []; // Ensure it's an array

      if (icao24s.length === 0) {
        console.warn(
          `[OpenSkySyncService] ⚠️ No ICAO24s found for ${manufacturer}`
        );
        return { updated: 0, total: 0 };
      }

      console.log(
        `[OpenSkySyncService] ✅ Found ${icao24s.length} ICAO24s for ${manufacturer}`
      );

      // Step 2: Fetch live aircraft data
      const aircraft = await this.fetchLiveAircraft(icao24s);

      // Step 3: Add pending aircraft to tracking (ensure `icao24Service` exists)
      try {
        if (icao24Service) {
          await icao24Service.addToPendingTracking(icao24s, manufacturer);
        } else {
          console.warn(
            `[OpenSkySyncService] ⚠️ icao24Service is not initialized.`
          );
        }
      } catch (error) {
        console.error(
          `[OpenSkySyncService] ❌ Error adding ICAO24s to tracking:`,
          error
        );
      }

      // ✅ Return updated and total counts
      return {
        updated: aircraft.length,
        total: icao24s.length,
      };
    } catch (error) {
      console.error(
        `[OpenSkySyncService] ❌ Error syncing ${manufacturer}:`,
        error
      );
      return { updated: 0, total: 0 };
    }
  }
}

// Export singleton instance
export const openSkySyncService = OpenSkySyncService.getInstance();
