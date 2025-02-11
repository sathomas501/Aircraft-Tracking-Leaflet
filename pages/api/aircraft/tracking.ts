import type { NextApiRequest, NextApiResponse } from 'next';
import trackingDatabaseManager from '../../../lib/db/trackingDatabaseManager';
import databaseManager from '../../../lib/db/databaseManager';
import { mergeStaticAndLiveData } from '@/utils/database-transforms'; // ✅ Import function

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { action, icao24s } = req.body; // ✅ Extracts `icao24s` correctly

    console.log(
      `[Tracking API] ✅ Received action: ${action}, ICAO24s:`,
      icao24s
    );

    if (!action || !Array.isArray(icao24s) || icao24s.length === 0) {
      console.error(
        '[Tracking API] ❌ Invalid tracking update request:',
        req.body
      );
      return res.status(400).json({ error: 'Invalid or missing ICAO24 list' });
    }

    // ✅ Fetch tracked aircraft from the database
    const aircraftData =
      await trackingDatabaseManager.getTrackedAircraftByICAOs(icao24s);

    if (aircraftData.length === 0) {
      console.warn(
        `[Tracking API] ⚠️ No aircraft found for the provided ICAO24s.`
      );
    }

    return res.status(200).json({ success: true, aircraft: aircraftData });
  } catch (error) {
    console.error(
      '[Tracking API] ❌ Error processing tracking request:',
      error
    );
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

/**
 * Updates the position of a tracked aircraft.
 */
export async function updateTrackedAircraftPosition(
  icao24: string,
  lat: number,
  lon: number,
  heading: number
) {
  console.log(
    `[Tracking] Updating position for ICAO24: ${icao24} to (${lat}, ${lon})`
  );
  try {
    await trackingDatabaseManager.updateAircraftPosition(
      icao24,
      lat,
      lon,
      heading
    );
    console.log(
      `[Tracking] Successfully updated position for ICAO24: ${icao24}`
    );
  } catch (error) {
    console.error(
      `[Tracking] Error updating position for ICAO24: ${icao24}`,
      error
    );
    throw error;
  }
}

/**
 * Removes an aircraft from the tracking database.
 */
export async function removeTrackedAircraft(icao24: string) {
  console.log(`[Tracking] Removing tracked aircraft with ICAO24: ${icao24}`);
  try {
    await trackingDatabaseManager.deleteAircraft(icao24);
    console.log(
      `[Tracking] Successfully removed aircraft with ICAO24: ${icao24}`
    );
  } catch (error) {
    console.error(
      `[Tracking] Error removing aircraft with ICAO24: ${icao24}`,
      error
    );
    throw error;
  }
}

/**
 * Clears all tracking data from the database.
 */
export async function resetTrackingData() {
  console.log('[Tracking] Clearing all tracked aircraft data...');
  try {
    await trackingDatabaseManager.clearTrackingData();
    console.log('[Tracking] Successfully cleared tracking data.');
  } catch (error) {
    console.error('[Tracking] Error clearing tracking data:', error);
    throw error;
  }
}
