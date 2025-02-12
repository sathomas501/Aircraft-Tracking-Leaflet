// services/aircraft-tracking-service.ts
import UnifiedCacheService from '@/lib/services/managers/unified-cache-system';
import {
  OpenSkyTransforms,
  normalizeAircraft,
} from '@/utils/aircraft-transform1';
import type {
  Aircraft,
  CachedAircraftData,
  OpenSkyStateArray,
  TrackingData,
} from '@/types/base';
import { DatabaseManager } from '@/lib/db/databaseManager';
import { TrackingDatabaseManager } from '@/lib/db/trackingDatabaseManager';

export class AircraftTrackingService {
  private static readonly BATCH_SIZE = 200;
  private readonly unifiedCache: UnifiedCacheService;
  private readonly staticDb: DatabaseManager;
  private readonly trackingDb: TrackingDatabaseManager;
  private readonly baseUrl: string;

  constructor() {
    this.unifiedCache = UnifiedCacheService.getInstance();
    this.staticDb = DatabaseManager.getInstance();
    this.trackingDb = TrackingDatabaseManager.getInstance();
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  private async getManufacturerIcao24s(
    manufacturer: string
  ): Promise<string[]> {
    try {
      const query = `
        SELECT DISTINCT icao24
        FROM aircraft
        WHERE manufacturer = ?
        AND icao24 IS NOT NULL
        AND icao24 != ''
        AND LENGTH(icao24) = 6
        AND LOWER(icao24) GLOB '[0-9a-f]*'
        LIMIT 2000
      `;

      const results = await this.staticDb.executeQuery<{ icao24: string }>(
        query,
        [manufacturer]
      );
      return results.map((row) => row.icao24.toLowerCase());
    } catch (error) {
      console.error(
        '[AircraftTrackingService] Failed to fetch ICAO24s:',
        error
      );
      return [];
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
      return [];
    }
  }

  private async getStaticAircraftData(
    icao24s: string[]
  ): Promise<Map<string, Aircraft>> {
    if (!icao24s.length) return new Map();

    const query = `
      SELECT *
      FROM aircraft
      WHERE icao24 IN (${icao24s.map(() => '?').join(',')})
    `;

    try {
      const staticData = await this.staticDb.executeQuery<Aircraft>(
        query,
        icao24s
      );
      return new Map(
        staticData.map((aircraft) => [aircraft.icao24.toLowerCase(), aircraft])
      );
    } catch (error) {
      console.error(
        '[AircraftTrackingService] Failed to fetch static data:',
        error
      );
      return new Map();
    }
  }

  async processManufacturer(manufacturer: string): Promise<Aircraft[]> {
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
      batches.push(icao24List.slice(i, i + AircraftTrackingService.BATCH_SIZE));
    }

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(
        `[AircraftTrackingService] Processing batch ${i + 1}/${batches.length}`
      );

      // Check tracking database first
      const trackedAircraft =
        await this.trackingDb.getTrackedAircraftByICAOs(batch);
      const trackedIcaos = new Set(
        trackedAircraft.map((a: Aircraft) => a.icao24.toLowerCase())
      );

      // Determine which ICAOs need fresh data
      const staleIcaos = batch.filter(
        (icao) => !trackedIcaos.has(icao.toLowerCase())
      );

      if (staleIcaos.length > 0) {
        const states = await this.fetchOpenSkyBatch(staleIcaos);
        if (states.length > 0) {
          // Transform to tracking data and update tracking database
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

          // Convert tracking data to Aircraft objects using normalizeAircraft
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

          await this.trackingDb.upsertLiveAircraftBatch(aircraftForDb);

          // Transform states to aircraft objects
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
