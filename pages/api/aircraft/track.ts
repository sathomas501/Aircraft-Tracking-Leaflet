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

      const pendingAircraft =
        await trackingDatabaseManager.getPendingAircraft(manufacturer);
      const pendingIcao24s = new Set(
        pendingAircraft.map((a) => a.icao24.toLowerCase())
      );

      const newIcao24s = icao24s.filter(
        (icao) =>
          !activeIcao24s.has(icao.toLowerCase()) &&
          !pendingIcao24s.has(icao.toLowerCase())
      );

      console.log(
        `[Track API] 📊 Status: ${activeAircraft.length} active, ${pendingAircraft.length} pending, ${newIcao24s.length} new to track`
      );

      let addedCount = 0;

      // ✅ Step 1: Process pending aircraft first
      if (pendingIcao24s.size > 0) {
        console.log(
          `[Track API] 🔄 Processing ${pendingIcao24s.size} pending aircraft with IcaoBatchService`
        );
        try {
          const icaoBatchService = new IcaoBatchService();
          const fetchedPendingAircraft = await icaoBatchService.processBatches(
            Array.from(pendingIcao24s),
            manufacturer
          );

          console.log(
            `[Track API] ✅ IcaoBatchService processed ${fetchedPendingAircraft.length} pending aircraft`
          );

          if (fetchedPendingAircraft.length > 0) {
            await trackingDatabaseManager.upsertActiveAircraftBatch(
              fetchedPendingAircraft
            );
            const trackedIcaos = fetchedPendingAircraft.map((a) => a.icao24);
            await trackingDatabaseManager.removePendingAircraft(trackedIcaos);
            console.log(
              `[Track API] 🧹 Removed ${trackedIcaos.length} processed aircraft from pending`
            );
          }
        } catch (error) {
          console.error(
            `[Track API] ❌ Error processing pending aircraft batch:`,
            error
          );
        }
      }

      // ✅ Step 2: Use CleanupService for stale aircraft
      console.log(`[Track API] 🗑️ Running CleanupService for stale aircraft`);
      const cleanupService = CleanupService.getInstance();
      await cleanupService.initialize();
      await cleanupService.cleanup();

      // ✅ Step 3: Add new aircraft to pending tracking
      if (newIcao24s.length > 0) {
        addedCount = await trackingDatabaseManager.addPendingAircraft(
          newIcao24s,
          manufacturer
        );
        console.log(
          `[Track API] ✅ Added ${addedCount} new aircraft to pending tracking`
        );

        const firstBatch = newIcao24s.slice(
          0,
          Math.min(100, newIcao24s.length)
        );
        console.log(
          `[Track API] 🔄 Processing ${firstBatch.length} new aircraft with IcaoBatchService`
        );

        try {
          const icaoBatchService = new IcaoBatchService();
          const fetchedAircraft = await icaoBatchService.processBatches(
            firstBatch,
            manufacturer
          );

          console.log(
            `[Track API] ✅ IcaoBatchService processed ${fetchedAircraft.length} new aircraft`
          );

          if (fetchedAircraft.length > 0) {
            await trackingDatabaseManager.upsertActiveAircraftBatch(
              fetchedAircraft
            );
            const trackedIcaos = fetchedAircraft.map((a) => a.icao24);
            await trackingDatabaseManager.removePendingAircraft(trackedIcaos);
            console.log(
              `[Track API] 🧹 Removed ${trackedIcaos.length} processed aircraft from pending`
            );
          }
        } catch (error) {
          console.error(
            `[Track API] ❌ Error processing batch with IcaoBatchService:`,
            error
          );
        }
      }

      return {
        success: true,
        message: `Added ${addedCount} aircraft to pending tracking. ${activeAircraft.length} already being tracked.`,
        count: addedCount,
        activeCount: activeAircraft.length,
        totalCount: icao24s.length,
        modelsCount: icao24s.length,
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
