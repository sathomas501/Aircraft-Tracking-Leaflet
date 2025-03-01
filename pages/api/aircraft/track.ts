// pages/api/aircraft/track.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import trackingDatabaseManager from '@/lib/db/managers/trackingDatabaseManager';
import staticDatabaseManager from '@/lib/db/managers/staticDatabaseManager';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { APIErrors } from '@/lib/services/error-handler/api-error';
import { Aircraft } from '@/types/base';
import { IcaoBatchService } from '@/lib/services/icao-batch-service';

// Track pending requests to prevent duplicates
const pendingRequests = new Map<string, Promise<any>>();

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    throw APIErrors.BadRequest('Method not allowed');
  }

  const { manufacturer } = req.body;
  if (!manufacturer) {
    throw APIErrors.BadRequest('Missing manufacturer in request');
  }

  // Check if we already have a pending request for this manufacturer
  const requestKey = `track-${manufacturer}`;
  if (pendingRequests.has(requestKey)) {
    console.log(`[Track API] ♻️ Reusing in-flight request for ${manufacturer}`);
    try {
      const result = await pendingRequests.get(requestKey);
      return res.status(200).json(result);
    } catch (error) {
      console.error(`[Track API] ❌ Error from reused request:`, error);
      throw error;
    }
  }

  // Create a new promise for this request
  const requestPromise = (async () => {
    try {
      console.log(
        `[Track API] 🚀 Initializing tracking for manufacturer: ${manufacturer}`
      );

      // Ensure static database is initialized
      if (!staticDatabaseManager.isReady) {
        await staticDatabaseManager.initializeDatabase();
      }

      // Validate the manufacturer exists
      const isValidManufacturer =
        await staticDatabaseManager.validateManufacturer(manufacturer);
      if (!isValidManufacturer) {
        console.warn(`[Track API] ⚠️ Invalid manufacturer: ${manufacturer}`);
        return {
          success: false,
          message: `Invalid manufacturer: ${manufacturer}`,
          count: 0,
        };
      }

      // Step 1: Fetch the models for this manufacturer
      console.log(
        `[Track API] 🔍 Fetching models for ${manufacturer} from Models API`
      );

      const models =
        await staticDatabaseManager.getModelsByManufacturer(manufacturer);

      if (!models || models.length === 0) {
        console.warn(
          `[Track API] ⚠️ No models found for manufacturer: ${manufacturer}`
        );
        return {
          success: true,
          message: `No models found for ${manufacturer}`,
          count: 0,
        };
      }

      console.log(
        `[Track API] 📋 Found ${models.length} models for ${manufacturer}`
      );

      // Step 2: Get ICAO24s for the manufacturer
      const icao24s =
        await staticDatabaseManager.getManufacturerIcao24s(manufacturer);

      if (!icao24s || icao24s.length === 0) {
        console.warn(
          `[Track API] ⚠️ No ICAO24s found for manufacturer: ${manufacturer}`
        );
        return {
          success: true,
          message: `No aircraft found for ${manufacturer}`,
          count: 0,
        };
      }

      console.log(
        `[Track API] 📋 Found ${icao24s.length} ICAO24s for ${manufacturer}`
      );

      // Step 3: Get static aircraft data for these ICAO24s
      const staticAircraftData =
        await staticDatabaseManager.getAircraftByIcao24s(icao24s);
      console.log(
        `[Track API] 📋 Retrieved ${staticAircraftData.length} static aircraft records`
      );

      // Create a map of models for fast lookup
      const modelMap = new Map<
        string,
        {
          model: string;
          manufacturer: string;
          count: number;
          activeCount: number;
          totalCount: number;
          label?: string;
        }
      >();

      models.forEach((modelData) => {
        modelMap.set(modelData.model, modelData);
      });

      // Debug the static aircraft data
      if (staticAircraftData.length > 0) {
        console.log(
          `[Track API] 🔍 Sample static aircraft data: ${JSON.stringify(staticAircraftData[0])}`
        );
      }

      // Create a map of ICAO24 to static data for efficient lookup
      const staticDataMap = new Map();
      for (const data of staticAircraftData) {
        if (data.icao24) {
          staticDataMap.set(data.icao24.toLowerCase(), data);
        }
      }

      // Ensure tracking database is initialized
      if (!trackingDatabaseManager.isReady) {
        await trackingDatabaseManager.initializeDatabase();
      }

      // Step 4: Check which ICAO24s are already being tracked or pending
      const activeAircraft =
        await trackingDatabaseManager.getTrackedAircraft(manufacturer);
      const activeIcao24s = new Set(
        activeAircraft.map((a) => a.icao24.toLowerCase())
      );

      // Find out which ICAO24s are not yet tracked
      const untrackedIcao24s = icao24s.filter(
        (icao) => !activeIcao24s.has(icao.toLowerCase())
      );

      console.log(
        `[Track API] 📊 Status: ${activeAircraft.length} active, ${untrackedIcao24s.length} new to track`
      );

      // Step 5: Add the untracked ICAO24s to pending_aircraft instead of tracked_aircraft
      let addedCount = 0;
      if (untrackedIcao24s.length > 0) {
        // Add to pending tracking
        addedCount = await trackingDatabaseManager.addPendingAircraft(
          untrackedIcao24s,
          manufacturer
        );
        console.log(
          `[Track API] ✅ Added ${addedCount} aircraft to pending tracking`
        );

        // Step 6: Process a small batch immediately using IcaoBatchService
        // This gives immediate results while keeping the API responsive
        const firstBatch = untrackedIcao24s.slice(
          0,
          Math.min(100, untrackedIcao24s.length)
        );
        console.log(
          `[Track API] 🔄 Processing ${firstBatch.length} aircraft with IcaoBatchService`
        );

        try {
          // Initialize the IcaoBatchService
          const icaoBatchService = new IcaoBatchService();

          // Process the batch directly
          const fetchedAircraft = await icaoBatchService.processBatches(
            firstBatch,
            manufacturer
          );

          console.log(
            `[Track API] ✅ IcaoBatchService processed ${fetchedAircraft.length} aircraft`
          );

          // If we found active aircraft, store them in the tracking database
          if (fetchedAircraft.length > 0) {
            // Move active aircraft to tracked_aircraft table
            await trackingDatabaseManager.upsertActiveAircraftBatch(
              fetchedAircraft
            );
            console.log(
              `[Track API] ✅ Stored ${fetchedAircraft.length} active aircraft in tracking database`
            );

            // Remove these from pending since they're now tracked
            const trackedIcaos = fetchedAircraft.map((a) => a.icao24);
            await trackingDatabaseManager.removePendingAircraft(trackedIcaos);
            console.log(
              `[Track API] 🧹 Removed ${trackedIcaos.length} aircraft from pending_aircraft`
            );
          } else {
            console.log(
              `[Track API] ℹ️ No active aircraft found from initial batch`
            );
          }
        } catch (error: any) {
          console.error(
            `[Track API] ❌ Error processing batch with IcaoBatchService:`,
            error
          );
        }
      }

      // Step 7: Log a sample pending aircraft for debugging
      if (untrackedIcao24s.length > 0) {
        const sample = staticDataMap.get(untrackedIcao24s[0].toLowerCase());
        console.log(
          `[Track API] 🔍 Sample pending aircraft: ${JSON.stringify({
            icao24: untrackedIcao24s[0],
            manufacturer,
            model: sample?.model || (models.length > 0 ? models[0].model : ''),
          })}`
        );
      }

      // Return success with counts
      return {
        success: true,
        message: `Added ${addedCount} aircraft to pending tracking. ${activeAircraft.length} already being tracked.`,
        count: addedCount,
        activeCount: activeAircraft.length,
        totalCount: icao24s.length,
        modelsCount: models.length,
      };
    } catch (error) {
      console.error(`[Track API] ❌ Error:`, error);
      throw error;
    }
  })();

  // Store the promise
  pendingRequests.set(requestKey, requestPromise);

  try {
    // Clean up the pending request after it completes
    const result = await requestPromise;
    pendingRequests.delete(requestKey);
    return res.status(200).json(result);
  } catch (error) {
    // Clean up on error too
    pendingRequests.delete(requestKey);
    console.error(`[Track API] ❌ Error:`, error);
    throw error;
  }
}

export default withErrorHandler(handler);
