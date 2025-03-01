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
    // Check if any of these ICAOs are already in our tracking database first
    const trackingDb = TrackingDatabaseManager.getInstance();

    // Try to get fresh data from tracking DB first (much faster)
    const existingAircraft = await trackingDb.getAircraftByIcao24(uniqueIcaos);
    console.log(
      `[ICAOFetcher] ✅ Found ${existingAircraft.length} aircraft in tracking DB`
    );

    // If we have data for all requested ICAOs, we can return it directly
    if (existingAircraft.length === uniqueIcaos.length) {
      console.log(
        '[ICAOFetcher] ✅ All requested aircraft found in tracking DB'
      );
      return {
        success: true,
        data: existingAircraft,
        source: 'database',
      };
    }

    // For missing aircraft, use the batch service to fetch from OpenSky
    // Filter out ICAOs we already have
    const existingIcaos = new Set(
      existingAircraft.map((a) => a.icao24.toLowerCase())
    );
    const missingIcaos = uniqueIcaos.filter((icao) => !existingIcaos.has(icao));

    console.log(
      `[ICAOFetcher] 🔍 Found ${existingAircraft.length} in DB, fetching ${missingIcaos.length} from OpenSky`
    );

    if (missingIcaos.length === 0) {
      // This shouldn't happen given our previous check, but just in case
      return {
        success: true,
        data: existingAircraft,
        source: 'database',
      };
    }

    // Use the ICAO batch service for missing aircraft
    const batchService = new IcaoBatchService();
    const openSkyAircraft = await batchService.processBatches(
      missingIcaos,
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
