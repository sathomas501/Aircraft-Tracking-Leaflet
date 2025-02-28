// services/aircraft-tracking-service.ts
import React, { useState, useEffect, useRef } from 'react';
import UnifiedCacheService from '../managers/unified-cache-system';
import { BaseTrackingService } from './base-tracking-service';
import { RateLimiterOptions } from '../rate-limiter';
import staticDatabaseManager from '../../db/managers/staticDatabaseManager';
import { OpenSkyTransforms } from '@/utils/aircraft-transform1';
import { TrackingDatabaseManager } from '@/lib/db/managers/trackingDatabaseManager';
import type {
  Aircraft,
  OpenSkyStateArray,
  CachedAircraftData,
} from '@/types/base';

// At the top of your aircraft-tracking-service.ts file

interface StateResponse {
  success: boolean;
  data: {
    states: OpenSkyStateArray[];
    timestamp: number;
    meta: {
      total: number;
      requestedIcaos: number;
    };
  };
}

// Singleton instance holder
let instance: AircraftTrackingService | null = null;

// Move this hook outside, it cannot be at the module level (React limitation)
// This should be used within a React component, not at file-level
// const [selectedManufacturer, setSelectedManufacturer] = useState<string | null>(null);

export class AircraftTrackingService extends BaseTrackingService {
  private readonly DEBUG = true;
  private static readonly BATCH_SIZE = 200;
  private trackedICAOs: Set<string> = new Set();
  private readonly unifiedCache: UnifiedCacheService;
  private readonly baseUrl: string;
  private readonly isServer: boolean;
  private trackingDatabaseManager: any = null;
  protected cacheService: any = null; // Changed to protected to match base class

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

  private constructor() {
    const rateLimiterOptions: RateLimiterOptions = {
      interval: 60 * 1000,
      retryAfter: 5000,
      requestsPerMinute: 60,
      requestsPerDay: 1000,
    };
    super(rateLimiterOptions);

    if (this.DEBUG) {
      console.log('[AircraftTracking] Service initialized with options:', {
        batchSize: AircraftTrackingService.BATCH_SIZE,
        rateLimiter: rateLimiterOptions,
      });
    }

    this.isServer = typeof window === 'undefined';
    this.unifiedCache = UnifiedCacheService.getInstance();
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    if (this.isServer) {
      try {
        this.trackingDatabaseManager =
          require('@/lib/db/managers/trackingDatabaseManager').default;

        // Initialize cacheService if needed on the server
        this.cacheService = require('@/lib/cache/cacheService').default;
      } catch (error) {
        console.error(
          '[AircraftTrackingService] Failed to load database manager:',
          error
        );
      }
    }
  }

  public static getInstance(): AircraftTrackingService {
    if (!instance) {
      instance = new AircraftTrackingService();
    }
    return instance;
  }

  // Implement abstract destroy method from BaseTrackingService
  public destroy(): void {
    this.manufacturerSubscriptions.clear();
    this.trackedICAOs.clear();
    this.cache.clear();
    if (this.rateLimiter) {
      this.rateLimiter.stop();
    }
  }

  private fetchQueue: Map<string, Promise<string[]>> = new Map();

  private async getManufacturerIcao24s(
    manufacturer: string
  ): Promise<string[]> {
    // ✅ Step 1: Check unified cache first (in-memory, fastest)
    const unifiedCacheData = this.unifiedCache.getLiveDataRaw(manufacturer);
    if (unifiedCacheData.length > 0) {
      console.log(
        `[AircraftTrackingService] ✅ Using unified cache for ${manufacturer}`
      );
      return unifiedCacheData.map((a: CachedAircraftData) => a.icao24);
    }

    // ✅ Step 2: Check persistent cache service
    const persistentCacheKey = `manufacturer-icao24s-${manufacturer}`;
    const persistentCacheData =
      await this.cacheService?.get(persistentCacheKey);
    if (persistentCacheData?.length > 0) {
      console.log(
        `[AircraftTrackingService] ✅ Using persistent cache for ${manufacturer}`
      );
      // Update unified cache from persistent cache
      this.unifiedCache.setLiveData(manufacturer, persistentCacheData);
      return persistentCacheData.map((a: CachedAircraftData) => a.icao24);
    }

    // ✅ Step 3: Check for in-flight requests
    if (this.fetchQueue.has(manufacturer)) {
      console.log(
        `[AircraftTrackingService] ⏳ Reusing in-flight request for ${manufacturer}`
      );
      return this.fetchQueue.get(manufacturer)!;
    }

    // ✅ Step 4: Fetch from Static Database if all caches miss
    console.log(
      `[AircraftTrackingService] 🔄 Cache miss. Fetching from static DB for ${manufacturer}`
    );

    // Create a new promise for this fetch
    const fetchPromise = new Promise<string[]>(async (resolve) => {
      const icao24List =
        await staticDatabaseManager.getManufacturerIcao24s(manufacturer);

      if (!icao24List || icao24List.length === 0) {
        console.warn(
          `[AircraftTrackingService] ❌ No ICAO24s found for ${manufacturer} in static DB`
        );
        return [];
      }

      // ✅ Step 4: Transform ICAO24 list to `Aircraft` type
      const aircraftData: Aircraft[] = icao24List.map((icao24) => ({
        icao24,
        'N-NUMBER': '', // Placeholder, should be fetched from DB if needed
        manufacturer,
        model: '',
        operator: '',
        NAME: '',
        CITY: '',
        STATE: '',
        OWNER_TYPE: '',
        created_at: new Date().toISOString(), // Default to current timestamp
        TYPE_AIRCRAFT: '',
        latitude: 0, // Default values, should be populated from tracking data
        longitude: 0,
        velocity: 0,
        heading: 0,
        altitude: 0,
        on_ground: false,
        isTracked: false,
        last_contact: Date.now() / 1000, // Unix timestamp
      }));

      // ✅ Cache the transformed `Aircraft` objects in both caches
      this.unifiedCache.setLiveData(manufacturer, aircraftData);
      await this.cacheService?.set(
        `manufacturer-icao24s-${manufacturer}`,
        aircraftData,
        60 * 60 // Cache for 1 hour
      );

      console.log(
        `[AircraftTrackingService] ✅ Cached ${aircraftData.length} ICAO24s for ${manufacturer}`
      );

      resolve(aircraftData.map((entry) => entry.icao24));
    });

    // Add this promise to the fetch queue
    this.fetchQueue.set(manufacturer, fetchPromise);

    try {
      const result = await fetchPromise;
      return result;
    } finally {
      // Clean up the fetch queue after completion
      this.fetchQueue.delete(manufacturer);
    }
  }

  private async getStaticAircraftData(
    icao24s: string[]
  ): Promise<Map<string, Aircraft>> {
    if (!icao24s.length) return new Map<string, Aircraft>();

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

      this.unifiedCache.setStaticData(data.aircraft);

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

  private async fetchOpenSkyBatch(
    icaoBatch: string[]
  ): Promise<OpenSkyStateArray[]> {
    if (!icaoBatch.length) return [];

    try {
      console.log('[AircraftTracking] Requesting OpenSky data:', {
        count: icaoBatch.length,
        sample: icaoBatch.slice(0, 3),
      });

      const response = await fetch(`${this.baseUrl}/api/proxy/opensky`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          icao24s: icaoBatch,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AircraftTracking] OpenSky request failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        return [];
      }

      const data = await response.json();
      console.log('[AircraftTracking] OpenSky response:', {
        success: data.success,
        statesCount: data.data?.states?.length || 0,
        sampleState: data.data?.states?.[0],
      });

      if (!data.success || !data.data?.states) {
        console.warn('[AircraftTracking] No states in response');
        return [];
      }

      return data.data.states.filter(OpenSkyTransforms.validateState);
    } catch (error) {
      console.error('[AircraftTracking] OpenSky fetch error:', error);
      return [];
    }
  }

  // In AircraftTrackingService class
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

      console.log('[AircraftTracking] Fetching from OpenSky:', {
        manufacturer,
        totalICAOs: icao24List.length,
        batchSize: AircraftTrackingService.BATCH_SIZE,
      });

      for (
        let i = 0;
        i < icao24List.length;
        i += AircraftTrackingService.BATCH_SIZE
      ) {
        const batch = icao24List.slice(
          i,
          i + AircraftTrackingService.BATCH_SIZE
        );

        console.log('[AircraftTracking] Requesting OpenSky batch:', {
          size: batch.length,
          sample: batch.slice(0, 3),
        });

        const response = await fetch(`${this.baseUrl}/api/proxy/opensky`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            icao24s: batch,
          }),
        });

        if (!response.ok) {
          console.error('[AircraftTracking] OpenSky proxy error:', {
            status: response.status,
            statusText: response.statusText,
          });
          continue;
        }

        const data = (await response.json()) as StateResponse;

        if (data.success && Array.isArray(data.data?.states)) {
          const newAircraft = data.data.states
            .filter((state): state is OpenSkyStateArray =>
              OpenSkyTransforms.validateState(state)
            )
            .map((state) =>
              OpenSkyTransforms.toExtendedAircraft(state, manufacturer)
            );

          if (newAircraft.length > 0) {
            console.log('[AircraftTracking] Found active aircraft:', {
              manufacturer,
              count: newAircraft.length,
              sample: newAircraft.slice(0, 2).map((a) => a.icao24),
            });
          }

          allAircraft = [...allAircraft, ...newAircraft];
        }
      }

      console.log('[AircraftTracking] OpenSky fetch complete:', {
        manufacturer,
        totalFound: allAircraft.length,
      });

      this.unifiedCache.setLiveData(manufacturer, allAircraft);
      return allAircraft;
    } catch (error) {
      console.error(
        `[AircraftTracking] ❌ Error processing manufacturer:`,
        error
      );
      throw error;
    }
  }

  // Method to notify subscribers about aircraft updates
  private onAircraftUpdate(aircraft: Aircraft[]): void {
    // Implement the logic to notify subscribers about aircraft updates
    if (aircraft.length > 0 && aircraft[0]?.manufacturer) {
      const manufacturer = aircraft[0].manufacturer;

      // Notify any subscribers for this manufacturer
      if (this.manufacturerSubscriptions.has(manufacturer)) {
        const callbacks = this.manufacturerSubscriptions.get(manufacturer)!;
        callbacks.forEach((callback) => {
          try {
            callback(aircraft);
          } catch (err) {
            console.error(`[AircraftTracking] Callback error:`, err);
          }
        });
      }
    }
  }

  // In AircraftTrackingService

  private async startTrackingManufacturer(manufacturer: string): Promise<void> {
    try {
      console.log(
        `[AircraftTracking] 🚀 Starting tracking for ${manufacturer}`
      );

      // ✅ Step 1: Get ICAO24s using optimized caching
      const icao24List = await this.cacheService.getIcao24s(manufacturer);

      if (!icao24List.length) {
        console.warn(
          `[AircraftTracking] ⚠️ No ICAO24s found for ${manufacturer}. Skipping tracking.`
        );
        return;
      }

      console.log(
        `[AircraftTracking] ✅ Retrieved ${icao24List.length} ICAOs for ${manufacturer}`
      );

      // ✅ Step 2: Check if tracking data is already cached
      const trackingCacheKey = `tracking-${manufacturer}`;
      const cachedTrackingData = await this.cacheService?.get(trackingCacheKey);

      if (cachedTrackingData) {
        console.log(
          `[AircraftTracking] 🔄 Using cached tracking data for ${manufacturer}`
        );
        return;
      }

      // ✅ Step 3: Fetch aircraft details from DB
      const aircraftDetails =
        await this.trackingDatabaseManager.getAircraftDetailsByIcao24s(
          icao24List
        );
      this.onAircraftUpdate(aircraftDetails);

      // ✅ Step 4: Fetch already tracked aircraft (use cache if available)
      let trackedAircraft =
        await this.trackingDatabaseManager.getTrackedAircraftCached(
          manufacturer
        );

      if (!trackedAircraft) {
        console.log(
          `[AircraftTracking] 🔍 Fetching tracked aircraft for ${manufacturer} from API...`
        );
        trackedAircraft = await this.fetchTrackedAircraft(manufacturer);
      }

      console.log(
        `[AircraftTracking] ✅ Tracked aircraft loaded: ${trackedAircraft.length}`
      );

      // ✅ Step 5: Identify new ICAOs that require tracking
      const alreadyTrackedIcao24s = new Set(
        trackedAircraft.map((a: any) => a.icao24)
      );
      const newICAOs = icao24List.filter(
        (icao: string) => !alreadyTrackedIcao24s.has(icao)
      );

      if (newICAOs.length === 0) {
        console.log(
          `[AircraftTracking] ✅ No new aircraft to track for ${manufacturer}`
        );
        return;
      }

      console.log(
        `[AircraftTracking] 🔄 Fetching OpenSky positions for ${newICAOs.length} new ICAOs`
      );

      // ✅ Step 6: Fetch OpenSky data only for new ICAOs
      const activeAircraft = await this.fetchOpenSkyBatch(newICAOs);

      if (activeAircraft.length > 0) {
        await this.updateAircraftPositions(activeAircraft, manufacturer);
      } else {
        console.log(
          `[AircraftTracking] ✅ No active aircraft found for ${manufacturer}`
        );
      }
    } catch (error) {
      console.error(
        `[AircraftTracking] ❌ Error in startTrackingManufacturer:`,
        {
          manufacturer,
          error: error instanceof Error ? error.message : error,
        }
      );
    }
  }

  private async fetchTrackedAircraft(
    manufacturer: string
  ): Promise<Aircraft[]> {
    try {
      const response = await fetch('/api/tracking/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getTrackedAircraft', manufacturer }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch tracked aircraft: ${response.statusText}`
        );
      }

      const { trackedAircraft } = await response.json();
      await this.trackingDatabaseManager.cacheTrackedAircraft(
        manufacturer,
        trackedAircraft
      );
      return trackedAircraft;
    } catch (error) {
      console.error(
        `[AircraftTracking] ❌ Failed to fetch tracked aircraft:`,
        error
      );
      return [];
    }
  }

  public async updateAircraftPositions(
    activeAircraft: any[],
    manufacturer: string
  ): Promise<void> {
    try {
      const positions = activeAircraft.map((state) => ({
        icao24: state[0],
        latitude: state[6],
        longitude: state[5],
        altitude: state[7],
        velocity: state[9],
        heading: state[10],
        on_ground: state[8],
        last_contact: state[4],
        manufacturer,
      }));

      console.log(
        `[AircraftTracking] 📡 Updating positions for ${positions.length} aircraft`
      );

      const response = await fetch('/api/tracking/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateBatch', positions }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update positions: ${response.statusText}`);
      }

      const { updated } = await response.json();
      console.log(
        `[AircraftTracking] ✅ Successfully updated ${updated} positions`
      );
    } catch (error) {
      console.error(
        `[AircraftTracking] ❌ Failed to update aircraft positions:`,
        error
      );
    }
  }
}

export const getAircraftTrackingService = () =>
  AircraftTrackingService.getInstance();
