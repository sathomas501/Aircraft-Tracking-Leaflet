// pages/api/aircraft/icao24s.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { StaticDatabaseManager } from '@/lib/db/managers/staticDatabaseManager';
import { TrackingDatabaseManager } from '@/lib/db/managers/trackingDatabaseManager';

interface IcaoResponse {
  success: boolean;
  data?: {
    icao24List: string[];
    allActive?: boolean;
  };
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<IcaoResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Please use POST.',
    });
  }

  try {
    const { manufacturer } = req.body;
    if (!manufacturer || typeof manufacturer !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Manufacturer is required and must be a string.',
      });
    }

    // ✅ Access the static getInstance method correctly
    const staticDb = StaticDatabaseManager.getInstance();
    const trackingDb = TrackingDatabaseManager.getInstance();

    // ✅ Validate manufacturer before fetching ICAO24s
    const isValid = await staticDb.validateManufacturer(manufacturer);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: `Invalid manufacturer: ${manufacturer}`,
      });
    }

    console.log(`[API] 🔍 Fetching ICAO24s for manufacturer: ${manufacturer}`);

    // ✅ Step 1: Retrieve all ICAOs for manufacturer from Static Database
    const allIcaos = await staticDb.getManufacturerIcao24s(manufacturer);
    console.log(`[API] 📋 Found ${allIcaos.length} ICAO24s in static DB.`);

    if (allIcaos.length === 0) {
      return res.status(200).json({
        success: true,
        data: { icao24List: [] },
      });
    }

    // ✅ Step 2: Retrieve categorized ICAOs from Tracking Database
    await trackingDb.updateAircraftStatus(); // Ensure statuses are updated first

    const activeIcaos = await trackingDb.getActiveIcao24s(manufacturer);
    const pendingIcaos = await trackingDb.getPendingIcao24s(manufacturer);
    const staleIcaos = await trackingDb.getStaleIcao24s(manufacturer);

    console.log(
      `[API] 🔄 Active: ${activeIcaos.length}, Pending: ${pendingIcaos.length}, Stale: ${staleIcaos.length}`
    );

    // ✅ Step 3: Identify new ICAOs that need to be tracked
    const newIcaos = allIcaos.filter(
      (icao: string) =>
        !activeIcaos.includes(icao) &&
        !pendingIcaos.includes(icao) &&
        !staleIcaos.includes(icao)
    );

    // ✅ Step 4: Register new ICAOs as "pending" before tracking
    if (newIcaos.length > 0) {
      await trackingDb.addPendingAircraft(newIcaos, manufacturer);
      console.log(`[API] ✂️ Added ${newIcaos.length} new ICAOs to pending.`);
    }

    // ✅ Step 5: Decide the response ICAO list
    let responseIcaos: string[];

    if (newIcaos.length > 0) {
      // If new ICAOs exist, return them for tracking
      responseIcaos = newIcaos;
    } else if (staleIcaos.length > 0) {
      // If no new ones, refresh stale ones
      responseIcaos = staleIcaos;
      console.log(`[API] 🔄 Returning ${staleIcaos.length} stale ICAOs.`);
    } else if (activeIcaos.length > 0) {
      // If no new or stale ones, return a sample of active ones
      const sampleSize = Math.min(20, activeIcaos.length);
      responseIcaos = activeIcaos
        .sort(() => 0.5 - Math.random()) // Randomize selection
        .slice(0, sampleSize);
      console.log(`[API] 🔄 Returning ${sampleSize} active ICAOs.`);
    } else {
      // No ICAOs available
      responseIcaos = [];
      console.log(`[API] ❌ No available ICAOs.`);
    }

    return res.status(200).json({
      success: true,
      data: {
        icao24List: responseIcaos,
        allActive:
          activeIcaos.length > 0 &&
          newIcaos.length === 0 &&
          staleIcaos.length === 0,
      },
    });
  } catch (error) {
    console.error('[API] ❌ Error processing ICAO24s request:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
