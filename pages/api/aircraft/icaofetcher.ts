// pages/api/aircraft/icaofetcher.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { TrackingDatabaseManager } from '@/lib/db/managers/trackingDatabaseManager';
import { IcaoBatchService } from '@/lib/services/icao-batch-service';

// Track active requests to prevent duplicates
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

  const icaoBatchService = new IcaoBatchService();
  const aircraft = await icaoBatchService.processBatches(icao24s, manufacturer);

  if (!icao24s || !Array.isArray(icao24s) || icao24s.length === 0) {
    console.error('[ICAOFetcher] ❌ Invalid or missing ICAO24 list');
    return res.status(400).json({ error: 'Invalid ICAO24 list' });
  }

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
  const requestPromise = processRequest(icao24s, manufacturer || '');
  activeRequests.set(requestKey, requestPromise);

  // Set cleanup after request completes
  requestPromise.finally(() => {
    setTimeout(() => {
      activeRequests.delete(requestKey);
    }, 1000); // Clean up after 1 second to handle potential rapid duplicate requests
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
 * Process the ICAO request with database integration and batch processing
 */
async function processRequest(icao24s: string[], manufacturer: string) {
  // Deduplicate and clean ICAO codes
  const uniqueIcaos = [
    ...new Set(icao24s.map((icao) => icao.toLowerCase().trim())),
  ];

  console.log(
    `[ICAOFetcher] 🔄 Processing ${uniqueIcaos.length} unique ICAOs from ${icao24s.length} total`
  );

  try {
    const trackingDb = TrackingDatabaseManager.getInstance();

    // Get existing aircraft from the tracking DB
    const existingAircraft = await trackingDb.getAircraftByIcao24(uniqueIcaos);
    console.log(
      `[ICAOFetcher] ✅ Found ${existingAircraft.length} aircraft in tracking DB`
    );

    // Define what "active" means - updated in the last hour
    const activeTimeThreshold = Date.now() - 60 * 60 * 1000; // 1 hour ago

    // Filter existing aircraft to find which ones are active
    const activeAircraft = existingAircraft.filter(
      (aircraft) => aircraft.last_contact * 1000 > activeTimeThreshold
    );

    // Create sets for quick lookups
    const existingIcaos = new Set(
      existingAircraft.map((a) => a.icao24.toLowerCase())
    );
    const activeIcaos = new Set(
      activeAircraft.map((a) => a.icao24.toLowerCase())
    );

    // STRATEGY:
    // 1. Track all currently active aircraft (no matter how many)
    // 2. Add up to 50 new aircraft we haven't seen before

    // First, include all active aircraft
    let icaosToFetch = uniqueIcaos.filter((icao) => activeIcaos.has(icao));

    // Then add up to 50 new aircraft
    const NEW_AIRCRAFT_LIMIT = 50;
    const newIcaos = uniqueIcaos
      .filter((icao) => !existingIcaos.has(icao)) // Not in DB yet
      .slice(0, NEW_AIRCRAFT_LIMIT); // Take only up to 50 new ones

    icaosToFetch = [...icaosToFetch, ...newIcaos];

    console.log(
      `[ICAOFetcher] ✈️ Tracking ${icaosToFetch.length} aircraft: ` +
        `${activeAircraft.length} active, ${newIcaos.length} new ` +
        `(new aircraft limit: ${NEW_AIRCRAFT_LIMIT})`
    );

    // Skip OpenSky fetch if we have nothing to fetch
    if (icaosToFetch.length === 0) {
      return {
        success: true,
        data: activeAircraft,
        source: 'database',
      };
    }

    // Use the ICAO batch service with our limited list
    const batchService = new IcaoBatchService();
    const openSkyAircraft = await batchService.processBatches(
      icaosToFetch,
      manufacturer
    );

    console.log(
      `[ICAOFetcher] 🔄 Received ${openSkyAircraft.length} aircraft from OpenSky`
    );

    // If no OpenSky data was found, just return what we had in the database
    if (openSkyAircraft.length === 0 && existingAircraft.length === 0) {
      console.log('[ICAOFetcher] ⚠️ No aircraft data found from any source');
      return {
        success: true,
        data: [],
        message: 'No aircraft data found',
      };
    }

    // Combine existing and new aircraft
    const combinedAircraft = [...existingAircraft, ...openSkyAircraft];

    console.log(
      `[ICAOFetcher] ✅ Returning ${combinedAircraft.length} aircraft (${existingAircraft.length} from DB, ${openSkyAircraft.length} from OpenSky)`
    );

    return {
      success: true,
      data: combinedAircraft,
      sources: {
        database: existingAircraft.length,
        opensky: openSkyAircraft.length,
      },
    };
  } catch (error) {
    console.error('[ICAOFetcher] ❌ Error fetching ICAO24 data:', error);
    throw error;
  }
}
