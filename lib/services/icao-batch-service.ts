// lib/services/icao-batch-service.ts - Updated version
import { API_CONFIG } from '@/config/api';
import type { Aircraft } from '@/types/base';
import { PollingRateLimiter } from '../services/rate-limiter';
import { RATE_LIMITS } from '@/config/rate-limits';
import { TrackingDatabaseManager } from '../db/managers/trackingDatabaseManager';
import { StaticDatabaseManager } from '../db/managers/staticDatabaseManager';
import {
  DataCleanupUtils,
  OpenSkyTransforms,
} from '../../utils/aircraft-transform1';
import { icao24Service } from './icao-service';
import { icao24CacheService } from './icao24Cache';

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
  private static readonly DEFAULT_BATCH_SIZE = 100; // Reduced batch size for better control
  private readonly baseUrl: string;
  private readonly rateLimiter: PollingRateLimiter;

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
      maxConcurrentRequests: 3, // Limit concurrent requests
      interval: 60000,
      retryAfter: 1000,
    });
  }

  private validateIcao24(icao: string): boolean {
    return /^[0-9a-f]{6}$/i.test(icao.trim());
  }

  private formatIcaos(icaos: string[]): string[] {
    // Deduplicate and clean ICAO codes
    const uniqueIcaos = new Set(icaos.map((code) => code.trim().toLowerCase()));
    return Array.from(uniqueIcaos).filter(this.validateIcao24);
  }

  private async fetchBatch(icaoBatch: string[]): Promise<IcaoBatchResponse> {
    return this.rateLimiter.schedule(async () => {
      try {
        console.log(
          `[IcaoBatchService] 📦 Sending batch of ${icaoBatch.length} ICAOs to OpenSky proxy...`
        );

        const response = await fetch(`${this.baseUrl}/api/proxy/opensky`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ icao24s: icaoBatch }),
          // Add timeout to prevent hanging requests
          signal: AbortSignal.timeout(20000),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        // Log the actual number of states received for tracking
        const statesCount = result.data?.states?.length || 0;
        console.log(
          `[IcaoBatchService] ✅ Received ${statesCount} states from OpenSky`
        );

        // Quick check on first state if available for debugging
        if (statesCount > 0) {
          console.log(
            `[IcaoBatchService] Sample state:`,
            JSON.stringify(result.data.states[0]).substring(0, 200)
          );
        }

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

  async processPendingAircraftBatch(batchSize = 100) {
    // In IcaoBatchService.ts
    const trackingDbManager = TrackingDatabaseManager.getInstance();
    const pendingAircraft = await trackingDbManager.getPendingAircraft();
    console.log(`[DEBUG] Pending aircraft count: ${pendingAircraft.length}`);

    console.log(
      `[IcaoBatchService] Processing ${pendingAircraft.length} pending aircraft`
    );

    // Process in batches
    for (let i = 0; i < pendingAircraft.length; i += batchSize) {
      const batch = pendingAircraft.slice(i, i + batchSize);
      console.log(
        `[IcaoBatchService] Processing batch ${i / batchSize + 1} of ${Math.ceil(pendingAircraft.length / batchSize)}`
      );

      // Get manufacturers from batch
      const manufacturers = new Set(
        batch.map((a) => a.manufacturer).filter(Boolean)
      );

      for (const manufacturer of manufacturers) {
        // Get aircraft for this manufacturer
        const manufacturerAircraft = batch.filter(
          (a) => a.manufacturer === manufacturer
        );

        // Add model information
        const staticDbManager = StaticDatabaseManager.getInstance();
        const models =
          await staticDbManager.getModelsByManufacturer(manufacturer);

        if (models && models.length > 0) {
          // Assign first model to all aircraft of this manufacturer
          const defaultModel = models[0].model;

          // Assign model
          for (const aircraft of manufacturerAircraft) {
            aircraft.model = defaultModel;
          }

          // Store in tracking database
          await trackingDbManager.upsertActiveAircraftBatch(
            manufacturerAircraft
          );

          // Remove from pending
          const icao24s = manufacturerAircraft.map((a) => a.icao24);
          await trackingDbManager.removePendingAircraft(icao24s);

          console.log(
            `[IcaoBatchService] Processed ${manufacturerAircraft.length} ${manufacturer} aircraft, assigned model: ${defaultModel}`
          );
        }
      }
    }
  }

  async processBatches(
    icao24List: string[],
    manufacturer: string
  ): Promise<Aircraft[]> {
    // Add this debug log to check manufacturer value
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

    const dbManager = StaticDatabaseManager.getInstance();
    const trackingDb = TrackingDatabaseManager.getInstance();
    const models = await dbManager.getModelsByManufacturer(manufacturer);

    if (!icao24List.length) {
      console.log(`[IcaoBatchService] ⚠️ No valid ICAO24s to process`);
      return [];
    }

    if (icao24List.length > 10) {
      console.log(
        `[IcaoBatchService] 📥 Processing ICAOs: { ${icao24List.slice(0, 5).join(', ')} ... ${icao24List.slice(-5).join(', ')} }`
      );
    } else {
      console.log(
        `[IcaoBatchService] 📥 Processing ICAOs: { ${icao24List.join(', ')} }`
      );
    }

    const validIcaos = this.formatIcaos(icao24List);
    console.log(`[IcaoBatchService] ✅ Valid ICAO codes: ${validIcaos.length}`);

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

    const batchSize =
      this.rateLimiter.maxAllowedBatchSize ||
      IcaoBatchService.DEFAULT_BATCH_SIZE;

    const batches: string[][] = [];
    for (let i = 0; i < untracked.length; i += batchSize) {
      batches.push(untracked.slice(i, i + batchSize));
    }

    console.log(`[IcaoBatchService] 📦 Split into ${batches.length} batches`);

    let allAircraft: Aircraft[] = [...existingAircraft]; // Start with existing aircraft
    let totalStates = 0;
    let transformedAircraft = 0;

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

          for (const rawState of batchResponse.data.states) {
            try {
              let aircraft: Aircraft | null = null;

              // Only process if it has valid position data (non-null lat/lon)
              if (
                Array.isArray(rawState) &&
                OpenSkyTransforms.validateState(rawState) &&
                rawState[5] !== null && // longitude not null
                rawState[6] !== null // latitude not null
              ) {
                // Transform state array to aircraft
                aircraft = OpenSkyTransforms.toExtendedAircraft(
                  rawState,
                  manufacturer
                );

                // Ensure model is set
                if (!aircraft.model || aircraft.model.trim() === '') {
                  console.warn(
                    `[IcaoBatchService] ⚠️ No model found for ${aircraft.icao24}. Attempting lookup.`
                  );
                  if (models && models.length > 0) {
                    // Use the first model instead of joining all models
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

                // Mark the aircraft as active
                aircraft.isTracked = true;
                aircraft.lastSeen = Date.now();

                validAircraft.push(aircraft);
                transformedAircraft++;
              } else {
                // Skip this state because it has no valid position
                continue;
              }
            } catch (error) {
              console.error(
                `[IcaoBatchService] ❌ Error processing state:`,
                error
              );
            }
          }

          if (validAircraft.length > 0) {
            allAircraft.push(...validAircraft);

            console.log(
              `[IcaoBatchService] ✅ Batch ${i + 1} processed ${validAircraft.length} valid aircraft`
            );

            try {
              // Only store aircraft with valid positions in tracked_aircraft
              await trackingDb.upsertActiveAircraftBatch(validAircraft);
              console.log(
                `[IcaoBatchService] 💾 Stored ${validAircraft.length} aircraft in tracking DB`
              );

              // Remove these from pending since they're now tracked
              const trackedIcaos = validAircraft.map((a) => a.icao24);
              await trackingDb.removePendingAircraft(trackedIcaos);
              console.log(
                `[IcaoBatchService] 🧹 Removed ${trackedIcaos.length} aircraft from pending`
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

    // Add any remaining untrackedIcaos to pending_aircraft
    try {
      // Get the ICAO24s that weren't processed (those without position data)
      const processedIcaos = new Set(
        allAircraft.map((a) => a.icao24.toLowerCase())
      );
      const stillUntracked = untracked.filter(
        (icao) => !processedIcaos.has(icao.toLowerCase())
      );

      if (stillUntracked.length > 0) {
        // Add these to pending_aircraft
        await trackingDb.addPendingAircraft(stillUntracked, manufacturer);
        console.log(
          `[IcaoBatchService] 📝 Added ${stillUntracked.length} inactive aircraft to pending_aircraft`
        );
      }
    } catch (error) {
      console.error(
        `[IcaoBatchService] ❌ Error adding to pending_aircraft:`,
        error
      );
    }

    console.log(
      `[IcaoBatchService] ✅ Total processing complete: ${totalStates} states received, ${transformedAircraft} successfully transformed, ${allAircraft.length} valid aircraft returned`
    );

    return allAircraft;
  }

  // Cache pending requests to prevent duplicate calls
  private pendingRequests: Set<string> = new Set();

  async fetchAircraftStates(icao24s: string[]): Promise<Aircraft[]> {
    if (!icao24s.length) {
      console.warn(`[IcaoBatchService] ⚠️ No ICAO24s provided.`);
      return [];
    }

    console.log(
      `[IcaoBatchService] 🔄 Requesting aircraft states for ${icao24s.length} ICAOs...`
    );

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/proxy/opensky`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ icao24s }),
        }
      );

      if (!response.ok) {
        console.error(
          `[IcaoBatchService] ❌ OpenSky API Error: ${response.statusText}`
        );
        return [];
      }

      const data = await response.json();
      if (!data?.data?.length) {
        console.warn(
          `[IcaoBatchService] ⚠️ OpenSky returned 0 states. Retrying in 5s...`
        );
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
        return this.fetchAircraftStates(icao24s);
      }

      return data.data;
    } catch (error) {
      console.error(
        `[IcaoBatchService] ❌ Error fetching aircraft states:`,
        error
      );
      return [];
    }
  }
}
