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
   * Fetches live aircraft data using the proxy API instead of direct OpenSky calls.
   */
  public async fetchLiveAircraft(icao24s: string[]): Promise<Aircraft[]> {
    if (icao24s.length === 0) return [];

    console.log(
      `[OpenSkySyncService] Fetching live data for ${icao24s.length} ICAOs...`
    );

    try {
      if (!this.dbManager) {
        throw new Error(
          '[OpenSkySyncService] ❌ Database manager is not available.'
        );
      }

      // ✅ Step 1: Check tracking database first
      const activeAircraft = await this.dbManager.getAircraftByIcao24(icao24s);
      if (activeAircraft.length > 0) {
        console.log(
          `[OpenSkySyncService] ✅ Found ${activeAircraft.length} active aircraft in tracking DB.`
        );
        return activeAircraft;
      }

      // ✅ Step 2: Call the OpenSky Proxy API
      console.log(
        `[OpenSkySyncService] 🔄 Fetching live aircraft from OpenSky proxy...`
      );
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/proxy/opensky`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ icao24s }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `[OpenSkySyncService] ❌ OpenSky Proxy API error: ${response.statusText}`
        );
      }

      const data = await response.json();
      if (!data.success || !data.data?.states) {
        throw new Error(
          '[OpenSkySyncService] ❌ Invalid response format from OpenSky Proxy'
        );
      }

      // ✅ Step 3: Transform and store data
      const liveAircraft = data.data.states.map(DatabaseTransforms.toTracking);
      await this.dbManager.upsertActiveAircraftBatch(liveAircraft);

      console.log(
        `[OpenSkySyncService] ✅ OpenSky Proxy returned ${liveAircraft.length} aircraft.`
      );
      return liveAircraft;
    } catch (error) {
      console.error(
        '[OpenSkySyncService] ❌ Error fetching live aircraft:',
        error
      );
      errorHandler.handleError(
        ErrorType.OPENSKY_SERVICE,
        'Error fetching live aircraft',
        { error }
      );
      return [];
    }
  }
}
