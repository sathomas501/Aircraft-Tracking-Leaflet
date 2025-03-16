// lib/services/icao-batch-service.ts - Updated version
import { API_CONFIG } from '@/config/api';
import type { Aircraft } from '@/types/base';
import { AircraftModel } from '@/types/aircraft-models';
import { PollingRateLimiter } from '../services/rate-limiter';
import { RATE_LIMITS } from '@/config/rate-limits';
import { TrackingDatabaseManager } from '../db/managers/trackingDatabaseManager';
import { StaticDatabaseManager } from '../db/managers/staticDatabaseManager';
import { OpenSkyTransforms } from '../../utils/aircraft-transform1';
import { icao24Service } from './icao-service';

interface IcaoBatchResponse {
  success: boolean;
  data?: {
    states: any[];
    timestamp: number;
    meta: { total: number; requestedIcaos: number };
  };
  error?: string;
}

export class IcaoBatchService {
  private static readonly DEFAULT_BATCH_SIZE = 100;
  private readonly baseUrl: string;
  private readonly rateLimiter: PollingRateLimiter;
  private modelCache: Record<string, any[]> = {}; // Local cache for batch processing
  private seenRequests = new Set<string>();

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    this.rateLimiter = new PollingRateLimiter({
      requestsPerMinute: RATE_LIMITS.AUTHENTICATED.REQUESTS_PER_10_MIN / 10,
      requestsPerDay: RATE_LIMITS.AUTHENTICATED.REQUESTS_PER_DAY,
      maxWaitTime: RATE_LIMITS.AUTHENTICATED.MAX_WAIT_TIME,
      minPollingInterval: RATE_LIMITS.AUTHENTICATED.MIN_INTERVAL,
      maxPollingInterval: RATE_LIMITS.AUTHENTICATED.MAX_CONCURRENT,
      maxBatchSize: RATE_LIMITS.AUTHENTICATED.BATCH_SIZE,
      retryLimit: API_CONFIG.API.MAX_RETRY_LIMIT,
      requireAuthentication: true,
      maxConcurrentRequests: 3,
      interval: 60000,
      retryAfter: 1000,
    });
  }

  private validateIcao24(icao: string): boolean {
    return /^[0-9a-f]{6}$/i.test(icao.trim());
  }

  private formatIcaos(icaos: string[]): string[] {
    const uniqueIcaos = new Set(icaos.map((code) => code.trim().toLowerCase()));
    return Array.from(uniqueIcaos).filter(this.validateIcao24);
  }

  private async fetchBatch(icaoBatch: string[]): Promise<IcaoBatchResponse> {
    return this.rateLimiter.schedule(async () => {
      try {
        console.log(
          `[IcaoBatchService] 📦 Sending batch of ${icaoBatch.length} ICAOs to OpenSky proxy...`
        );

        if (this.seenRequests.has(JSON.stringify(icaoBatch))) {
          console.warn(
            `[IcaoBatchService] 🚫 Duplicate ICAO batch detected! Skipping.`
          );
          return {
            success: false,
            data: { states: [], timestamp: Date.now() },
          };
        }

        this.seenRequests.add(JSON.stringify(icaoBatch));

        console.log(
          `[IcaoBatchService] 🚀 Sending batch request to OpenSky from ${new Error().stack}`
        );
        const response = await fetch(`${this.baseUrl}/api/proxy/opensky`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ icao24s: icaoBatch }),
          signal: AbortSignal.timeout(20000),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        const statesCount = result.data?.states?.length || 0;

        console.log(
          `[IcaoBatchService] ✅ Received ${statesCount} states from OpenSky`
        );

        return result;
      } catch (error) {
        console.error(`[IcaoBatchService] ❌ Batch fetch error:`, error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Network error during fetch',
          data: {
            states: [],
            timestamp: Date.now(),
            meta: { total: 0, requestedIcaos: icaoBatch.length },
          },
        };
      }
    });
  }

  async processBatches(
    icao24List: string[],
    manufacturer: string
  ): Promise<Aircraft[]> {
    console.log(
      `[IcaoBatchService] 🔍 Processing ${icao24List.length} ICAO codes for manufacturer: "${manufacturer}"`
    );

    // If ICAO24 list is empty, attempt to get from centralized service
    if (!icao24List.length && manufacturer) {
      console.log(
        `[IcaoBatchService] 🔍 No ICAO24s provided, attempting to fetch for ${manufacturer}`
      );
      icao24List = await icao24Service.getManufacturerIcao24s(manufacturer);
      console.log(
        `[IcaoBatchService] ✅ Retrieved ${icao24List.length} ICAO24s from service`
      );
    }

    console.log(
      `[IcaoBatchService] 🔍 Checking models for manufacturer: "${manufacturer}"`
    );

    const dbManager = StaticDatabaseManager.getInstance();
    const trackingDb = TrackingDatabaseManager.getInstance();
    const models = await this.fetchModelsFromAPI(manufacturer);

    if (!icao24List.length) {
      console.log(`[IcaoBatchService] ⚠️ No valid ICAO24s to process`);
      return [];
    }

    const validIcaos = this.formatIcaos(icao24List);
    console.log(`[IcaoBatchService] ✅ Valid ICAO codes: ${validIcaos.length}`);
    console.log(
      `[IcaoBatchService] 🔍 Models found: ${models.length}, Sample:`,
      models.slice(0, 5)
    );

    // Check which ICAO24s are already in the tracking database
    const existingAircraft = await trackingDb.getAircraftByIcao24(validIcaos);
    const existingIcaos = new Set(
      existingAircraft.map((a) => a.icao24.toLowerCase())
    );

    // Only process ICAO24s that aren't already being tracked
    const untracked = validIcaos.filter(
      (icao) => !existingIcaos.has(icao.toLowerCase())
    );

    console.log(
      `[IcaoBatchService] 📊 Status: ${existingAircraft.length} already tracked, ${untracked.length} need processing`
    );

    // If all are already tracked, just return the existing aircraft
    if (untracked.length === 0) {
      console.log(
        `[IcaoBatchService] ✅ All aircraft already tracked, no OpenSky needed`
      );
      return existingAircraft;
    }

    // Add after this line in your processBatches method:
    // const untracked = validIcaos.filter((icao) => !existingIcaos.has(icao.toLowerCase()));

    const batchSize =
      this.rateLimiter.maxAllowedBatchSize ||
      IcaoBatchService.DEFAULT_BATCH_SIZE;

    // Create batches properly
    const batches: string[][] = [];
    const seenIcaos = new Set<string>();

    // Current batch
    let currentBatch: string[] = [];

    for (let i = 0; i < untracked.length; i++) {
      const icao = untracked[i];

      // Skip duplicates
      if (seenIcaos.has(icao)) {
        console.warn(
          `[IcaoBatchService] ⚠️ Skipping duplicate ICAO24: ${icao}`
        );
        continue;
      }

      seenIcaos.add(icao);
      currentBatch.push(icao);

      // When current batch reaches max size, add to batches and reset
      if (currentBatch.length >= batchSize) {
        batches.push([...currentBatch]);
        currentBatch = [];
      }
    }

    // Add the last batch if it has any items
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    console.log(`[IcaoBatchService] 📦 Split into ${batches.length} batches`);

    let allAircraft: Aircraft[] = [...existingAircraft]; // Start with existing aircraft
    let totalStates = 0;
    let transformedAircraft = 0;

    console.log(
      `[IcaoBatchService] 🚀 Processing ${icao24List.length} ICAOs for manufacturer: "${manufacturer}"`
    );
    console.log(
      `[IcaoBatchService] 🔍 ICAO24 List: ${JSON.stringify(icao24List)}`
    );

    const uniqueIcaos = Array.from(new Set(icao24List));
    if (uniqueIcaos.length !== icao24List.length) {
      console.warn(
        `[IcaoBatchService] ⚠️ Duplicate ICAOs detected in request! Removing duplicates.`
      );
    }

    for (let i = 0; i < batches.length; i++) {
      console.log(
        `[IcaoBatchService] 🚀 Fetching batch ${i + 1} / ${batches.length}`
      );

      // Get the first 3 ICAOs for logging
      const sampleIcaos = batches[i].slice(0, 3);
      console.log(
        `[IcaoBatchService] 🚀 Sending ICAOs to OpenSky API: ${sampleIcaos.join(', ')} ... (${batches[i].length} total)`
      );

      try {
        const batchResponse = await this.fetchBatch(batches[i]);

        if (batchResponse.success && batchResponse.data?.states?.length) {
          const statesReceived = batchResponse.data.states.length;
          totalStates += statesReceived;

          const validAircraft: Aircraft[] = [];

          // Process each state with proper format handling
          for (const rawState of batchResponse.data.states) {
            try {
              let aircraft: Aircraft | null = null;

              // Check if state is array or object
              if (Array.isArray(rawState)) {
                console.log(
                  `[IcaoBatchService] Processing array state for ICAO: ${rawState[0]}`
                );
                aircraft = OpenSkyTransforms.toExtendedAircraft(
                  rawState,
                  manufacturer
                );
              } else if (typeof rawState === 'object' && rawState !== null) {
                console.log(
                  `[IcaoBatchService] Processing object state for ICAO: ${rawState.icao24}`
                );
                aircraft = OpenSkyTransforms.toExtendedAircraftFromObject(
                  rawState,
                  manufacturer
                );
              } else {
                console.warn(
                  `[IcaoBatchService] ⚠️ Invalid state format:`,
                  rawState
                );
                continue;
              }

              if (!aircraft) {
                console.warn(
                  `[IcaoBatchService] ⚠️ Failed to create aircraft from state:`,
                  rawState
                );
                continue;
              }

              // Ensure manufacturer is set correctly
              if (
                !aircraft.manufacturer ||
                aircraft.manufacturer === 'Unknown'
              ) {
                console.warn(
                  `[IcaoBatchService] ⚠️ Manufacturer missing for ${aircraft.icao24}. Explicitly setting to: "${manufacturer}"`
                );
                aircraft.manufacturer = manufacturer;
              }

              // Ensure model is set
              if (!aircraft.model || aircraft.model.trim() === '') {
                console.log(
                  `[IcaoBatchService] ⚠️ No model found for ${aircraft.icao24}. Attempting lookup.`
                );
                if (models && models.length > 0) {
                  aircraft.model = models[0].model;
                  console.log(
                    `[IcaoBatchService] ✅ Set model for ${aircraft.icao24}: ${models[0].model}`
                  );
                } else {
                  console.warn(
                    `[IcaoBatchService] ❌ No model found in DB for ${aircraft.icao24}`
                  );
                }
              }

              // Mark as active
              aircraft.isTracked = true;
              aircraft.lastSeen = Date.now();

              validAircraft.push(aircraft);
              transformedAircraft++;

              console.log(
                `[IcaoBatchService] ✅ Successfully transformed ${aircraft.icao24}`
              );
            } catch (error) {
              console.error(
                `[IcaoBatchService] ❌ Error processing state:`,
                error,
                'raw state sample:',
                typeof rawState === 'object'
                  ? Array.isArray(rawState)
                    ? rawState.slice(0, 5)
                    : JSON.stringify(rawState).substring(0, 100)
                  : rawState
              );
            }
          }

          if (validAircraft.length > 0) {
            allAircraft.push(...validAircraft);

            console.log(
              `[IcaoBatchService] ✅ Batch ${i + 1} processed ${validAircraft.length} valid aircraft`
            );

            try {
              // Store in tracking database
              await trackingDb.upsertActiveAircraftBatch(validAircraft);
              console.log(
                `[IcaoBatchService] 💾 Stored ${validAircraft.length} aircraft in tracking DB`
              );
            } catch (dbError) {
              console.error(
                `[IcaoBatchService] ❌ Error storing in tracking DB:`,
                dbError
              );
            }
          } else {
            console.log(
              `[IcaoBatchService] ℹ️ No active aircraft found in batch ${i + 1}`
            );
          }
        } else {
          console.log(
            `[IcaoBatchService] ℹ️ No states received from OpenSky for batch ${i + 1}`
          );
        }
      } catch (error) {
        console.error(
          `[IcaoBatchService] ❌ Error processing batch ${i + 1}`,
          error
        );
      }
    }

    console.log(
      `[IcaoBatchService] ✅ Total processing complete: ${totalStates} states received, ${transformedAircraft} successfully transformed, ${allAircraft.length} valid aircraft returned`
    );

    return allAircraft;
  }

  public triggerManualPoll(
    icao24List: string[],
    manufacturer: string
  ): Promise<Aircraft[]> {
    // Clear the seen requests cache to allow a fresh poll
    this.seenRequests.clear();
    console.log(
      `[IcaoBatchService] 🔄 Manual polling triggered for ${manufacturer}`
    );
    return this.processBatches(icao24List, manufacturer);
  }

  // Cache to store models per manufacturer
  private async fetchModelsFromAPI(manufacturer: string): Promise<any[]> {
    if (this.modelCache[manufacturer]) {
      console.log(
        `[IcaoBatchService] 🔁 Using cached models for ${manufacturer}`
      );
      return this.modelCache[manufacturer];
    }

    try {
      console.log(
        `[IcaoBatchService] 🔍 Fetching models from API for: ${manufacturer}`
      );

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/aircraft/models?manufacturer=${encodeURIComponent(manufacturer)}`
      );

      if (!response.ok) {
        throw new Error(
          `Models API error: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        this.modelCache[manufacturer] = result.data; // ✅ Cache the response
        return result.data;
      }

      return [];
    } catch (error) {
      console.error(`[IcaoBatchService] ❌ Error fetching models:`, error);
      return [];
    }
  }
}
