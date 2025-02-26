// lib/services/openSkySyncService.ts
import { Aircraft } from '@/types/base';
import UnifiedCacheService from '@/lib/services/managers/unified-cache-system';
import {
  errorHandler,
  ErrorType,
} from '../services/error-handler/error-handler';
import { DatabaseTransforms } from '@/utils/aircraft-transform1';
import { TrackingDatabaseManager } from '../db/managers/trackingDatabaseManager';

export class OpenSkySyncService {
  private static instance: OpenSkySyncService;
  private cache: UnifiedCacheService;
  private dbManager: TrackingDatabaseManager | null = null; // ✅ Initialize to `null`

  private constructor() {
    this.cache = UnifiedCacheService.getInstance();

    // ✅ Ensure `dbManager` is initialized only on the server-side
    if (typeof window === 'undefined') {
      const {
        TrackingDatabaseManager,
      } = require('@/lib/db/managers/trackingDatabaseManager');
      this.dbManager = TrackingDatabaseManager.getInstance();
    }
  }

  public static getInstance(): OpenSkySyncService {
    if (!OpenSkySyncService.instance) {
      OpenSkySyncService.instance = new OpenSkySyncService();
    }
    return OpenSkySyncService.instance;
  }

  /**
   */
  async fetchLiveAircraft(icao24s: string[]): Promise<any[]> {
    if (!icao24s || icao24s.length === 0) {
      console.warn('[OpenSkySyncService] ⚠️ No ICAO24s provided');
      return [];
    }

    try {
      console.log(
        `[OpenSkySyncService] 🔄 Requesting live data for ${icao24s.length} ICAOs...`
      );

      // ✅ Calls the fetcher instead of OpenSky Proxy
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
          `[OpenSkySyncService] ❌ Fetcher API Error: ${response.statusText}`
        );
      }

      return response.json();
    } catch (error) {
      console.error(
        '[OpenSkySyncService] ❌ Error fetching live aircraft:',
        error
      );
      return [];
    }
  }
}
