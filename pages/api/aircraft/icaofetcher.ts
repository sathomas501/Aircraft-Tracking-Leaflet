// pages/api/aircraft/icaofetcher.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import trackingDatabaseManagerPromise from '@/lib/db/managers/trackingDatabaseManager';
import staticDatabaseManagerPromise from '@/lib/db/managers/staticDatabaseManager';
import { IcaoBatchService } from '@/lib/services/icao-batch-service';
import { AircraftRecord, Aircraft } from '@/types/base';

// In-memory cache for active ICAO fetch requests
const activeRequests = new Map<string, Promise<any>>();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[ICAOFetcher] 📡 Received Request:', req.method);

  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ error: 'Method Not Allowed. Use POST instead.' });
  }

  const { icao24s, manufacturer } = req.body;

  if (!icao24s || !Array.isArray(icao24s) || icao24s.length === 0) {
    console.error('[ICAOFetcher] ❌ Invalid or missing ICAO24 list');
    return res.status(400).json({ error: 'Invalid ICAO24 list' });
  }

  // Ensure manufacturer is defined
  const selectedManufacturer = manufacturer || 'Unknown';

  // Create a cache key for this request
  const requestKey = JSON.stringify(icao24s.sort());

  // Check if this exact request is already in progress
  if (activeRequests.has(requestKey)) {
    console.log(
      '[ICAOFetcher] ⚠️ Duplicate request detected, reusing in-progress request'
    );
    try {
      const result = await activeRequests.get(requestKey);
      return res.status(200).json(result);
    } catch (error) {
      console.error('[ICAOFetcher] ❌ Error from reused request:', error);
      return res.status(500).json({ error: 'Error processing request' });
    }
  }

  // Create a new promise for this request
  const requestPromise = processRequest(icao24s, selectedManufacturer);
  activeRequests.set(requestKey, requestPromise);

  // Cleanup cache after request completes
  requestPromise.finally(() => {
    setTimeout(() => {
      activeRequests.delete(requestKey);
    }, 1000);
  });

  try {
    const result = await requestPromise;
    return res.status(200).json(result);
  } catch (error) {
    console.error('[ICAOFetcher] ❌ Error processing request:', error);
    return res.status(500).json({
      error: 'Error processing request',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Process ICAO request with database integration, batch processing, and static data caching.
 */
async function processRequest(icao24s: string[], manufacturer: string) {
  const uniqueIcaos = [
    ...new Set(icao24s.map((icao) => icao.toLowerCase().trim())),
  ];

  console.log(`[ICAOFetcher] 🔄 Processing ${uniqueIcaos.length} unique ICAOs`);

  try {
    // Get database instances by awaiting the promises
    const trackingDb = await trackingDatabaseManagerPromise;
    const staticDb = await staticDatabaseManagerPromise;

    // 1️⃣ **Retrieve static data for ICAOs**
    const staticAircraft = await staticDb.getAircraftByIcao24s(uniqueIcaos);
    const staticAircraftMap = new Map(
      staticAircraft.map((a: AircraftRecord) => [a.icao24, a])
    );

    console.log(
      `[ICAOFetcher] 🛠 Retrieved ${staticAircraft.length} aircraft from static DB`
    );

    // 2️⃣ **Check tracking DB for existing aircraft**
    const existingAircraft = await trackingDb.getAircraftByIcao24(uniqueIcaos);
    console.log(
      `[ICAOFetcher] ✅ Found ${existingAircraft.length} aircraft in tracking DB`
    );

    // 3️⃣ **Filter active aircraft (last update < 1 hour)**
    const activeTimeThreshold = Date.now() - 60 * 60 * 1000; // 1 hour ago
    const activeAircraft = existingAircraft.filter(
      (aircraft: Aircraft) =>
        (aircraft.last_contact || 0) * 1000 > activeTimeThreshold
    );

    const existingIcaos = new Set(
      existingAircraft.map((a: Aircraft) => a.icao24.toLowerCase())
    );
    const activeIcaos = new Set(
      activeAircraft.map((a: Aircraft) => a.icao24.toLowerCase())
    );

    // 4️⃣ **Select ICAOs to fetch: Active + up to 50 new ones**
    let icaosToFetch = uniqueIcaos.filter((icao) => activeIcaos.has(icao));
    const NEW_AIRCRAFT_LIMIT = 50;
    const newIcaos = uniqueIcaos
      .filter((icao) => !existingIcaos.has(icao)) // Not in DB yet
      .slice(0, NEW_AIRCRAFT_LIMIT);

    icaosToFetch = [...icaosToFetch, ...newIcaos];

    console.log(
      `[ICAOFetcher] ✈️ Tracking ${icaosToFetch.length} aircraft: ${activeAircraft.length} active, ${newIcaos.length} new`
    );

    // 5️⃣ **Fetch live data from OpenSky only if needed**
    let openSkyAircraft: Aircraft[] = [];
    if (icaosToFetch.length > 0) {
      const batchService = new IcaoBatchService();
      openSkyAircraft = (await batchService.processBatches(
        icaosToFetch,
        manufacturer
      )) as Aircraft[];
      console.log(
        `[ICAOFetcher] 🔄 Received ${openSkyAircraft.length} aircraft from OpenSky`
      );
    }

    // 6️⃣ **Merge static + OpenSky results**
    const mergedAircraft = openSkyAircraft.map((aircraft: Aircraft) => {
      const staticInfo = staticAircraftMap.get(aircraft.icao24) || {};
      return { ...staticInfo, ...aircraft }; // Merge static + live data
    });

    // 7️⃣ **Drop ICAOs that OpenSky did not return**
    const activeIcaoSet = new Set(
      openSkyAircraft.map((a: Aircraft) => a.icao24)
    );
    const finalAircraftList = mergedAircraft.filter((a: Aircraft) =>
      activeIcaoSet.has(a.icao24)
    );

    console.log(
      `[ICAOFetcher] ✅ Returning ${finalAircraftList.length} aircraft`
    );

    return {
      success: true,
      data: finalAircraftList,
      sources: {
        staticDb: staticAircraft.length,
        trackingDb: existingAircraft.length,
        opensky: openSkyAircraft.length,
      },
    };
  } catch (error) {
    console.error('[ICAOFetcher] ❌ Error fetching ICAO24 data:', error);
    throw error;
  }
}
