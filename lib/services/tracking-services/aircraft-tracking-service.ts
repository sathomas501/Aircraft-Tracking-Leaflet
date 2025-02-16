// services/aircraft-tracking-service.ts
import UnifiedCacheService from '@/lib/services/managers/unified-cache-system';
import {
  OpenSkyTransforms,
  normalizeAircraft,
} from '@/utils/aircraft-transform1';
import type { Aircraft, OpenSkyStateArray, TrackingData } from '@/types/base';
import trackingManager from '@/lib/db/trackingDatabaseManager';
import {
  errorHandler,
  ErrorType,
} from '@/lib/services/error-handler/error-handler';

export class AircraftTrackingService {
  private static readonly BATCH_SIZE = 200;
  private readonly unifiedCache: UnifiedCacheService;
  private readonly baseUrl: string;

  constructor() {
    this.unifiedCache = UnifiedCacheService.getInstance();
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  private async getManufacturerIcao24s(
    manufacturer: string
  ): Promise<string[]> {
    try {
      console.log(
        '[AircraftTrackingService] 🔍 Fetching ICAOs for manufacturer:',
        manufacturer
      );

      const url = `${this.baseUrl}/api/aircraft/icao24s?manufacturer=${encodeURIComponent(manufacturer)}`;
      console.log('[AircraftTrackingService] 📡 Request URL:', url);

      const response = await fetch(url);

      console.log(
        '[AircraftTrackingService] 📥 Response status:',
        response.status
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('[AircraftTrackingService] 📦 Raw API response:', data);

      if (!data.success) {
        console.error(
          '[AircraftTrackingService] ❌ API reported failure:',
          data.error || 'Unknown error'
        );
        return [];
      }

      if (!data.data?.icao24List) {
        console.error(
          '[AircraftTrackingService] ❌ Missing icao24List in response:',
          data
        );
        return [];
      }

      const icao24List = data.data.icao24List;
      console.log(
        `[AircraftTrackingService] ✅ Successfully fetched ${icao24List.length} ICAOs`
      );

      return icao24List;
    } catch (error) {
      console.error('[AircraftTrackingService] ❌ Error fetching ICAO24s:', {
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        manufacturer,
      });

      errorHandler.handleError(
        ErrorType.OPENSKY_SERVICE,
        error instanceof Error ? error : new Error('Failed to fetch ICAO24s'),
        { manufacturer }
      );

      return [];
    }
  }

  private async getStaticAircraftData(
    icao24s: string[]
  ): Promise<Map<string, Aircraft>> {
    if (!icao24s.length) return new Map();

    try {
      const response = await fetch(`${this.baseUrl}/api/aircraft/static-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icao24s }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return new Map(
        data.aircraft.map((aircraft: Aircraft) => [
          aircraft.icao24.toLowerCase(),
          aircraft,
        ])
      );
    } catch (error) {
      console.error(
        '[AircraftTrackingService] Failed to fetch static data:',
        error
      );
      errorHandler.handleError(
        ErrorType.OPENSKY_SERVICE,
        error instanceof Error
          ? error
          : new Error('Failed to fetch static data')
      );
      return new Map();
    }
  }

  private async fetchOpenSkyBatch(
    icaoBatch: string[]
  ): Promise<OpenSkyStateArray[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/proxy/opensky`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icao24s: icaoBatch }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.success ? data.data.states : [];
    } catch (error) {
      console.error(
        `[AircraftTrackingService] OpenSky batch fetch error:`,
        error
      );
      errorHandler.handleError(
        ErrorType.OPENSKY_SERVICE,
        error instanceof Error ? error : new Error('OpenSky batch fetch failed')
      );
      return [];
    }
  }

  async processManufacturer(manufacturer: string): Promise<Aircraft[]> {
    try {
      // Check cache first
      const cachedData = this.unifiedCache.getLiveData(manufacturer);
      if (cachedData.length > 0) {
        console.log(
          `[AircraftTrackingService] Using cached data for ${manufacturer}`
        );
        return cachedData;
      }

      // Get ICAO codes for manufacturer
      const icao24List = await this.getManufacturerIcao24s(manufacturer);
      if (!icao24List.length) {
        console.log(
          `[AircraftTrackingService] No ICAO codes found for ${manufacturer}`
        );
        return [];
      }

      // Get static data for these aircraft
      const staticDataMap = await this.getStaticAircraftData(icao24List);

      // Process in batches
      let allAircraft: Aircraft[] = [];
      const batches: string[][] = [];

      for (
        let i = 0;
        i < icao24List.length;
        i += AircraftTrackingService.BATCH_SIZE
      ) {
        batches.push(
          icao24List.slice(i, i + AircraftTrackingService.BATCH_SIZE)
        );
      }

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(
          `[AircraftTrackingService] Processing batch ${i + 1}/${batches.length}`
        );

        // Get tracked aircraft
        const trackedAircraft =
          await trackingManager.getTrackedAircraftByICAOs(batch);
        const trackedIcaos = new Set(
          trackedAircraft.map((a: Aircraft) => a.icao24.toLowerCase())
        );

        // Determine which ICAOs need fresh data
        const now = Math.floor(Date.now() / 1000);
        const staleIcaos = batch.filter((icao) => {
          const existingAircraft = trackedAircraft.find(
            (a: Aircraft) => a.icao24.toLowerCase() === icao.toLowerCase()
          );
          return !existingAircraft || now - existingAircraft.last_contact > 60;
        });

        if (staleIcaos.length > 0) {
          const states = await this.fetchOpenSkyBatch(staleIcaos);
          if (states.length > 0) {
            // Transform states to tracking data
            const trackingData: TrackingData[] = states.map(
              (state: OpenSkyStateArray) => ({
                icao24: state[0],
                latitude: state[6] || 0,
                longitude: state[5] || 0,
                altitude: state[7] || 0,
                velocity: state[9] || 0,
                heading: state[10] || 0,
                on_ground: state[8] || false,
                last_contact: state[4] || Math.floor(Date.now() / 1000),
                updated_at: Date.now(),
              })
            );

            // Convert to Aircraft objects
            const aircraftForDb = trackingData.map((td) =>
              normalizeAircraft({
                ...td,
                'N-NUMBER': '',
                manufacturer,
                model: 'Unknown',
                NAME: '',
                CITY: '',
                STATE: '',
                OWNER_TYPE: '',
                TYPE_AIRCRAFT: '',
                isTracked: true,
              })
            );

            await trackingManager.upsertLiveAircraft(aircraftForDb);

            // Transform states to aircraft objects with static data
            const newAircraft = states.map((state: OpenSkyStateArray) => {
              const baseAircraft = OpenSkyTransforms.toExtendedAircraft(
                state,
                manufacturer
              );
              const staticData = staticDataMap.get(
                baseAircraft.icao24.toLowerCase()
              );
              return staticData
                ? normalizeAircraft({ ...baseAircraft, ...staticData })
                : baseAircraft;
            });

            allAircraft = [...allAircraft, ...newAircraft];
          }
        }

        // Add tracked aircraft to results
        const trackedWithStatic = trackedAircraft.map((tracked: Aircraft) => {
          const staticData = staticDataMap.get(tracked.icao24.toLowerCase());
          return staticData
            ? normalizeAircraft({ ...tracked, ...staticData })
            : normalizeAircraft(tracked);
        });

        allAircraft = [...allAircraft, ...trackedWithStatic];

        if (i < batches.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      // Update cache with combined results
      if (allAircraft.length > 0) {
        this.unifiedCache.setLiveData(manufacturer, allAircraft);
      }

      return allAircraft;
    } catch (error) {
      console.error(
        '[AircraftTrackingService] Process manufacturer error:',
        error
      );
      errorHandler.handleError(
        ErrorType.OPENSKY_SERVICE,
        error instanceof Error
          ? error
          : new Error('Failed to process manufacturer')
      );
      throw error;
    }
  }

  subscribeToManufacturer(
    manufacturer: string,
    callback: (aircraft: Aircraft[]) => void
  ): () => void {
    return this.unifiedCache.subscribe(manufacturer, callback);
  }

  clearManufacturerCache(manufacturer: string): void {
    this.unifiedCache.clearCache(manufacturer);
  }
}

// Export singleton instance
const aircraftTrackingService = new AircraftTrackingService();
export default aircraftTrackingService;
