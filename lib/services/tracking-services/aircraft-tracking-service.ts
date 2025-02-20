// services/aircraft-tracking-service.ts
import UnifiedCacheService from '../managers/unified-cache-system';
import { BaseTrackingService } from './base-tracking-service';
import { RateLimiterOptions } from '../rate-limiter';
import {
  OpenSkyTransforms,
  CacheTransforms,
  normalizeAircraft,
} from '@/utils/aircraft-transform1';
import type {
  Aircraft,
  OpenSkyStateArray,
  CachedAircraftData,
} from '@/types/base';
let trackingDatabaseManager: any;

if (typeof window === 'undefined') {
  trackingDatabaseManager =
    require('@/lib/db/managers/trackingDatabaseManager').default;
}

interface ManufacturerSubscription {
  manufacturer: string;
  callback: (data: Aircraft[]) => void;
  unsubscribe: () => void;
}

export class AircraftTrackingService extends BaseTrackingService {
  private static readonly BATCH_SIZE = 200;
  private trackedICAOs: Set<string> = new Set();
  private readonly unifiedCache: UnifiedCacheService;
  private readonly baseUrl: string;
  private manufacturerSubscriptions: Map<
    string,
    Set<(data: Aircraft[]) => void>
  > = new Map();
  private cache: Map<
    string,
    {
      data: CachedAircraftData[];
      timestamp: number;
      subscriptions: Set<(data: CachedAircraftData[]) => void>;
    }
  > = new Map();

  constructor() {
    const rateLimiterOptions: RateLimiterOptions = {
      interval: 60 * 1000,
      retryAfter: 5000,
      requestsPerMinute: 60,
      requestsPerDay: 1000,
    };
    super(rateLimiterOptions);

    this.unifiedCache = UnifiedCacheService.getInstance();
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    this.unifiedCache = UnifiedCacheService.getInstance();
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  private normalizeKey(manufacturer: string): string {
    return manufacturer.toLowerCase().replace(/\s+/g, '_');
  }

  public setLiveData(manufacturer: string, aircraft: Aircraft[]): void {
    const key = this.normalizeKey(manufacturer);
    const cachedData: CachedAircraftData[] = aircraft.map(
      CacheTransforms.toCache
    );

    const entry = this.cache.get(key) || {
      data: [],
      timestamp: Date.now(),
      subscriptions: new Set<(data: CachedAircraftData[]) => void>(),
    };

    entry.data = cachedData;
    entry.timestamp = Date.now();
    this.cache.set(key, entry);

    entry.subscriptions.forEach((callback) => callback(cachedData));
  }

  public subscribeToManufacturer(
    manufacturer: string,
    callback: (data: Aircraft[]) => void
  ): ManufacturerSubscription {
    if (!this.manufacturerSubscriptions.has(manufacturer)) {
      this.manufacturerSubscriptions.set(manufacturer, new Set());
    }

    const subscribers = this.manufacturerSubscriptions.get(manufacturer)!;
    subscribers.add(callback);

    this.startTrackingManufacturer(manufacturer);

    return {
      manufacturer,
      callback,
      unsubscribe: () => {
        const subs = this.manufacturerSubscriptions.get(manufacturer);
        if (subs) {
          subs.delete(callback);
          if (subs.size === 0) {
            this.manufacturerSubscriptions.delete(manufacturer);
            this.stopTrackingManufacturer(manufacturer);
          }
        }
      },
    };
  }

  private async addICAOsToTracking(icaos: string[]): Promise<void> {
    if (!icaos.length) return;

    try {
      const response = await fetch('/api/tracking/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addICAOs',
          icaos,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error('Failed to add ICAOs to tracking');
      }

      console.log(
        `[Tracking] ✅ Successfully added ${icaos.length} ICAOs to tracking`
      );
    } catch (error) {
      console.error(`[Tracking] ❌ Error adding ICAOs to tracking:`, error);
    }
  }

  private async startTrackingManufacturer(manufacturer: string): Promise<void> {
    try {
      const response = await fetch('/api/aircraft/icao24s', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ICAO24s: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.data?.icao24List) {
        await this.addICAOsToTracking(data.data.icao24List);
      }
    } catch (error) {
      super.handleError(error);
    }
  }

  private async stopTrackingManufacturer(manufacturer: string): Promise<void> {
    try {
      const response = await fetch('/api/aircraft/icao24s', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ICAO24s: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.data?.icao24List) {
        for (const icao of data.data.icao24List) {
          this.trackedICAOs.delete(icao);
        }
      }
    } catch (error) {
      super.handleError(error);
    }
  }

  protected onDataUpdate(aircraft: Aircraft[]): void {
    // Group aircraft by manufacturer
    const byManufacturer = new Map<string, Aircraft[]>();
    for (const ac of aircraft) {
      if (ac.manufacturer) {
        const mfr = ac.manufacturer.toLowerCase();
        if (!byManufacturer.has(mfr)) {
          byManufacturer.set(mfr, []);
        }
        byManufacturer.get(mfr)!.push(ac);
      }
    }

    // Notify manufacturer subscribers
    for (const [manufacturer, subscribers] of this.manufacturerSubscriptions) {
      const aircraftForMfr =
        byManufacturer.get(manufacturer.toLowerCase()) || [];
      subscribers.forEach((callback) => callback(aircraftForMfr));
    }
  }

  public destroy(): void {
    this.manufacturerSubscriptions.clear();
    this.trackedICAOs.clear();
    this.rateLimiter.stop();
  }

  private async getStaticAircraftData(
    icao24s: string[]
  ): Promise<Map<string, Aircraft>> {
    if (!icao24s.length) return new Map<string, Aircraft>();

    // First, check the cache
    const cachedAircraft: Aircraft[] = icao24s
      .map((icao24) => this.unifiedCache.getStaticData(icao24))
      .filter((a): a is Aircraft => a !== undefined);

    if (cachedAircraft.length === icao24s.length) {
      console.log(
        `[AircraftTrackingService] ✅ Using cached static data for ${icao24s.length} aircraft`
      );
      return new Map<string, Aircraft>(
        cachedAircraft.map((a) => [a.icao24.toLowerCase(), a])
      );
    }

    try {
      console.log(
        `[AircraftTrackingService] 🔍 Fetching static aircraft data for ${icao24s.length} aircraft`
      );

      // 🔄 Call the new API route
      const response = await fetch('/api/aircraft/static-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icao24s }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success || !data.aircraft) {
        throw new Error('Invalid response from static data API');
      }

      // Store fetched data in the cache
      this.unifiedCache.setStaticData(data.aircraft);

      // Convert fetched data into a Map
      return new Map<string, Aircraft>(
        data.aircraft.map((aircraft: Aircraft) => [
          aircraft.icao24.toLowerCase(),
          aircraft,
        ])
      );
    } catch (error) {
      console.error(
        `[AircraftTrackingService] ❌ Error fetching static aircraft data:`,
        error
      );
      return new Map<string, Aircraft>();
    }
  }

  private async getManufacturerIcao24s(
    manufacturer: string
  ): Promise<string[]> {
    const cachedIcao24s = this.unifiedCache.getLiveDataRaw(manufacturer);

    if (cachedIcao24s.length > 0) {
      console.log(
        `[AircraftTrackingService] ✅ Using cached ICAO24s for ${manufacturer}`
      );
      return cachedIcao24s.map((a) => a.icao24);
    }

    try {
      console.log(
        `[AircraftTrackingService] 🔍 Fetching ICAOs for manufacturer: ${manufacturer}`
      );
      const url = `${this.baseUrl}/api/aircraft/icao24s?manufacturer=${encodeURIComponent(manufacturer)}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success || !data.data?.icao24List) {
        throw new Error(data.error || 'Invalid response');
      }

      const cachedAircraft: Aircraft[] = data.data.icao24List
        .map((icao24: string) => this.unifiedCache.getStaticData(icao24))
        .filter((a: Aircraft | undefined): a is Aircraft => a !== undefined);

      this.unifiedCache.setLiveData(
        manufacturer,
        data.data.icao24List.map((icao24: string) => ({ icao24 }))
      );

      return data.data.icao24List;
    } catch (error) {
      console.error(
        `[AircraftTrackingService] ❌ Error fetching ICAO24s:`,
        error
      );
      return [];
    }
  }

  private async fetchOpenSkyBatch(
    icaoBatch: string[]
  ): Promise<OpenSkyStateArray[]> {
    if (!icaoBatch.length) return [];

    const cachedData = this.unifiedCache.getLiveDataRaw('opensky');
    const cachedIcaos = cachedData.map((a) => a.icao24.toLowerCase());
    const missingIcao24s = icaoBatch.filter(
      (icao) => !cachedIcaos.includes(icao)
    );

    console.log(
      `[AircraftTrackingService] ✅ Using cached OpenSky data for ${cachedIcaos.length} aircraft`
    );
    console.log(
      `[AircraftTrackingService] 🔍 Fetching new OpenSky data for ${missingIcao24s.length} aircraft`
    );

    let fetchedStates: OpenSkyStateArray[] = [];

    if (missingIcao24s.length > 0) {
      try {
        const response = await fetch(`${this.baseUrl}/api/proxy/opensky`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ icao24s: missingIcao24s }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        fetchedStates = data.success ? data.data.states : [];

        const aircraftForCache: Aircraft[] = fetchedStates.map((state) =>
          OpenSkyTransforms.toExtendedAircraft(state, 'Unknown')
        );

        this.unifiedCache.setLiveData('opensky', aircraftForCache);
      } catch (error) {
        console.error(
          `[AircraftTrackingService] ❌ OpenSky batch fetch error:`,
          error
        );
      }
    }

    const formattedCachedData: OpenSkyStateArray[] = cachedData.map(
      (a) =>
        [
          a.icao24,
          '',
          '',
          0,
          a.last_contact || Math.floor(Date.now() / 1000),
          a.longitude || 0,
          a.latitude || 0,
          a.altitude || 0,
          a.on_ground || false,
          a.velocity || 0,
          a.heading || 0,
          0,
          [],
          0,
          '',
          false,
          0,
        ] as OpenSkyStateArray
    );

    return [...formattedCachedData, ...fetchedStates];
  }

  async processManufacturer(manufacturer: string): Promise<Aircraft[]> {
    try {
      const cachedData = this.unifiedCache.getLiveData(manufacturer);
      if (cachedData.length > 0) {
        console.log(
          `[AircraftTrackingService] ✅ Using cached live data for ${manufacturer}`
        );
        return cachedData;
      }

      const icao24List = await this.getManufacturerIcao24s(manufacturer);
      if (!icao24List.length) return [];

      const staticDataMap = await this.getStaticAircraftData(icao24List);

      let allAircraft: Aircraft[] = [];

      for (
        let i = 0;
        i < icao24List.length;
        i += AircraftTrackingService.BATCH_SIZE
      ) {
        const batch = icao24List.slice(
          i,
          i + AircraftTrackingService.BATCH_SIZE
        );

        let trackedAircraft: Aircraft[] = [];
        if (typeof window === 'undefined' && trackingDatabaseManager) {
          trackedAircraft =
            await trackingDatabaseManager.getAircraftByIcao24(batch);
        }

        const staleIcaos = batch.filter(
          (icao) => !trackedAircraft.some((a) => a.icao24 === icao)
        );
        const freshStates = await this.fetchOpenSkyBatch(staleIcaos);

        const newAircraft = freshStates.map((state) =>
          normalizeAircraft({ ...state, manufacturer })
        );
        allAircraft = [...allAircraft, ...newAircraft, ...trackedAircraft];
      }

      this.unifiedCache.setLiveData(manufacturer, allAircraft);
      return allAircraft;
    } catch (error) {
      console.error(
        `[AircraftTrackingService] ❌ Error processing manufacturer:`,
        error
      );
      throw error;
    }
  }
}

const aircraftTrackingService = new AircraftTrackingService();
export default aircraftTrackingService;
