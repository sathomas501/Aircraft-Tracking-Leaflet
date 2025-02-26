// pages/api/aircraft/track.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { TrackingDatabaseManager } from '@/lib/db/managers/trackingDatabaseManager';
import staticDatabaseManager from '@/lib/db/managers/staticDatabaseManager';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { APIErrors } from '@/lib/services/error-handler/api-error';
import { Aircraft } from '@/types/base';

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

      // Get ICAO24s for the manufacturer
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

      // Get tracking database manager instance
      const trackingDb = TrackingDatabaseManager.getInstance();

      // Create minimal Aircraft objects for tracking initialization
      const currentTime = Math.floor(Date.now() / 1000); // Current timestamp in seconds
      const aircraft = icao24s.map((icao24) => ({
        icao24, // Make sure this is never null or empty
        manufacturer,
        latitude: 0,
        longitude: 0,
        altitude: 0,
        on_ground: true,
        last_contact: Math.floor(Date.now() / 1000) - 48 * 60 * 60, // Old timestamp
        updated_at: Math.floor(Date.now() / 1000),
        'N-NUMBER': '',
        heading: 0,
        velocity: 0,
        NAME: '',
        CITY: '',
        STATE: '',
        OWNER_TYPE: '',
        TYPE_AIRCRAFT: '',
        isTracked: false,
      }));

      // Process in smaller batches to avoid overwhelming the database
      const BATCH_SIZE = 100;
      let totalProcessed = 0;

      for (let i = 0; i < aircraft.length; i += BATCH_SIZE) {
        const batch = aircraft.slice(i, i + BATCH_SIZE);
        console.log(
          `[Track API] 🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(aircraft.length / BATCH_SIZE)}`
        );

        const batchCount = await trackingDb.upsertActiveAircraftBatch(batch);
        totalProcessed += batchCount;
      }

      // Then use totalProcessed instead of batchCount in your response
      return {
        success: true,
        message: `Initialized tracking for ${totalProcessed} aircraft`,
        count: totalProcessed,
        icao24s,
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
