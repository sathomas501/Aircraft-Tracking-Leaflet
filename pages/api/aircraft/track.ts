import type { NextApiRequest, NextApiResponse } from 'next';
import trackingDatabaseManager from '@/lib/db/managers/trackingDatabaseManager';
import staticDatabaseManager from '@/lib/db/managers/staticDatabaseManager';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { APIErrors } from '@/lib/services/error-handler/api-error';
import { IcaoBatchService } from '@/lib/services/icao-batch-service';
import CleanupService from '../../../lib/services/CleanupService';

const pendingRequests = new Map<string, Promise<any>>();

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    throw APIErrors.BadRequest('Method not allowed');
  }

  const { manufacturer } = req.body;
  if (!manufacturer) {
    throw APIErrors.BadRequest('Missing manufacturer in request');
  }

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

  const requestPromise = (async () => {
    try {
      console.log(
        `[Track API] 🚀 Initializing tracking for manufacturer: ${manufacturer}`
      );

      if (!staticDatabaseManager.isReady) {
        await staticDatabaseManager.initializeDatabase();
      }

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

      if (!trackingDatabaseManager.isReady) {
        await trackingDatabaseManager.initializeDatabase();
      }

      const activeAircraft =
        await trackingDatabaseManager.getTrackedAircraft(manufacturer);
      const activeIcao24s = new Set(
        activeAircraft.map((a) => a.icao24.toLowerCase())
      );

      // Filter out aircraft that are already actively tracked
      const newIcao24s = icao24s.filter(
        (icao) => !activeIcao24s.has(icao.toLowerCase())
      );

      console.log(
        `[Track API] 📊 Status: ${activeAircraft.length} active, ${newIcao24s.length} new to track`
      );

      // ✅ Step 1: Use CleanupService for stale aircraft
      console.log(`[Track API] 🗑️ Running CleanupService for stale aircraft`);
      const cleanupService = CleanupService.getInstance();
      await cleanupService.initialize();
      await cleanupService.cleanup();

      // ✅ Step 2: Add new aircraft to tracking in batches
      let processedCount = 0;
      let addedCount = 0;
      const BATCH_SIZE = 100;

      if (newIcao24s.length > 0) {
        console.log(
          `[Track API] ✅ Processing ${newIcao24s.length} aircraft in batches of ${BATCH_SIZE}`
        );

        for (let i = 0; i < newIcao24s.length; i += BATCH_SIZE) {
          const batch = newIcao24s.slice(
            i,
            Math.min(i + BATCH_SIZE, newIcao24s.length)
          );
          const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(newIcao24s.length / BATCH_SIZE);

          console.log(
            `[Track API] 🔄 Processing batch ${batchNumber}/${totalBatches} (${batch.length} aircraft)`
          );

          try {
            const icaoBatchService = new IcaoBatchService();
            const fetchedAircraft = await icaoBatchService.processBatches(
              batch,
              manufacturer
            );

            processedCount += batch.length;

            if (fetchedAircraft.length > 0) {
              await trackingDatabaseManager.upsertActiveAircraftBatch(
                fetchedAircraft
              );
              addedCount += fetchedAircraft.length;
              console.log(
                `[Track API] ✅ Batch ${batchNumber}: Found ${fetchedAircraft.length} active aircraft out of ${batch.length} processed`
              );
            } else {
              console.log(
                `[Track API] ℹ️ Batch ${batchNumber}: No active aircraft found in batch of ${batch.length}`
              );
            }

            // Add a small delay between batches to avoid overwhelming the API
            if (i + BATCH_SIZE < newIcao24s.length) {
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          } catch (error) {
            console.error(
              `[Track API] ❌ Error processing batch ${batchNumber}:`,
              error
            );
          }
        }

        console.log(
          `[Track API] 🏁 Completed processing ${processedCount} aircraft, added ${addedCount} active aircraft to tracking`
        );
      }

      return {
        success: true,
        message: `Added ${addedCount} aircraft to tracking. ${activeAircraft.length} already being tracked.`,
        count: addedCount,
        activeCount: activeAircraft.length + addedCount,
        totalCount: icao24s.length,
        processedCount: processedCount,
      };
    } catch (error) {
      console.error(`[Track API] ❌ Error:`, error);
      throw error;
    }
  })();

  pendingRequests.set(requestKey, requestPromise);

  try {
    const result = await requestPromise;
    pendingRequests.delete(requestKey);
    return res.status(200).json(result);
  } catch (error) {
    pendingRequests.delete(requestKey);
    throw error;
  }
}

export default withErrorHandler(handler);
