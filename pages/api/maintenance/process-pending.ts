// pages/api/maintenance/process-pending.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { TrackingDatabaseManager } from '@/lib/db/managers/trackingDatabaseManager';
import { StaticDatabaseManager } from '@/lib/db/managers/staticDatabaseManager';
import { Aircraft as BaseAircraft } from '@/types/base';

interface PendingAircraft {
  icao24: string;
  manufacturer?: string;
  model?: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  heading?: number;
  velocity?: number;
  on_ground?: boolean;
  last_contact?: number;
}

// Extract the core logic to a separate function that can be imported elsewhere
export async function processPendingAircraft(manufacturer?: string): Promise<{
  success: boolean;
  message: string;
  processedCount: number;
  activeCount: number;
}> {
  try {
    const trackingDb = TrackingDatabaseManager.getInstance();
    const staticDb = StaticDatabaseManager.getInstance();

    // Get pending aircraft - only use method we know exists
    let pendingAircraft = await trackingDb.getPendingAircraft();

    // If manufacturer is specified, filter the results
    if (manufacturer) {
      pendingAircraft = pendingAircraft.filter(
        (aircraft) => aircraft.manufacturer === manufacturer
      );
    }

    console.log(
      `[Maintenance] Processing ${pendingAircraft.length} pending aircraft${manufacturer ? ` for ${manufacturer}` : ''}`
    );

    if (pendingAircraft.length === 0) {
      return {
        success: true,
        message: `No pending aircraft to process${manufacturer ? ` for ${manufacturer}` : ''}`,
        processedCount: 0,
        activeCount: 0,
      };
    }

    // Group by manufacturer for efficient processing
    const manufacturerGroups = new Map<string, PendingAircraft[]>();
    pendingAircraft.forEach((aircraft: PendingAircraft) => {
      const mfg = aircraft.manufacturer || 'Unknown';
      if (!manufacturerGroups.has(mfg)) {
        manufacturerGroups.set(mfg, []);
      }
      manufacturerGroups.get(mfg)?.push(aircraft);
    });

    // Process each manufacturer group
    let totalProcessed = 0;
    let activeFound = 0;

    for (const [mfg, aircraftList] of manufacturerGroups.entries()) {
      console.log(
        `[Maintenance] Processing ${aircraftList.length} pending aircraft for ${mfg}`
      );

      // Try to get positions from OpenSky for this manufacturer's aircraft
      const icao24s = aircraftList.map((a: PendingAircraft) => a.icao24);

      console.log(
        `[Maintenance] Fetching OpenSky positions for ${icao24s.length} aircraft`
      );

      try {
        // This is a server-side API, so we need to use the full URL
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

        // Send ICAO24s to OpenSky proxy to get positions
        const response = await fetch(`${apiUrl}/api/proxy/opensky`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ icao24s }),
        });

        let activeAircraft: any[] = [];

        if (response.ok) {
          const result = await response.json();

          if (result.success && result.data?.states?.length > 0) {
            console.log(
              `[Maintenance] Found ${result.data.states.length} active aircraft from OpenSky`
            );

            // Process the active aircraft states
            activeAircraft = result.data.states.filter(
              (state: any) =>
                Array.isArray(state) && state[5] !== null && state[6] !== null // Has valid lat/lon
            );

            // Create a map of active ICAO24s
            const activeIcao24Map = new Map<
              string,
              {
                latitude: number;
                longitude: number;
                altitude?: number;
                velocity?: number;
                heading?: number;
                on_ground?: boolean;
                last_contact?: number;
              }
            >();

            activeAircraft.forEach((state: any) => {
              activeIcao24Map.set(state[0].toLowerCase(), {
                latitude: state[6],
                longitude: state[5],
                altitude: state[7],
                velocity: state[9],
                heading: state[10],
                on_ground: state[8],
                last_contact: state[4],
              });
            });

            // Get models for this manufacturer
            const models = await staticDb.getModelsByManufacturer(mfg);
            const defaultModel =
              models && models.length > 0 ? models[0].model : mfg;

            // Create aircraft objects for active aircraft with position data
            const activeIcao24s = Array.from(activeIcao24Map.keys());
            const aircraftToTrack: BaseAircraft[] = [];

            for (const aircraft of aircraftList) {
              const icao24 = aircraft.icao24.toLowerCase();

              // Only process aircraft with active position data
              if (activeIcao24Map.has(icao24)) {
                const position = activeIcao24Map.get(icao24);

                aircraftToTrack.push({
                  icao24: aircraft.icao24,
                  'N-NUMBER': 'Unknown',
                  manufacturer: mfg,
                  model: aircraft.model || defaultModel,
                  operator: 'Unknown',
                  latitude: position!.latitude,
                  longitude: position!.longitude,
                  altitude: position?.altitude || 0,
                  heading: position?.heading || 0,
                  velocity: position?.velocity || 0,
                  on_ground: position?.on_ground || false,
                  last_contact:
                    position?.last_contact || Math.floor(Date.now() / 1000),
                  NAME: 'Unknown',
                  CITY: 'Unknown',
                  STATE: 'Unknown',
                  OWNER_TYPE: 'Unknown',
                  TYPE_AIRCRAFT: 'Unknown',
                  isTracked: true,
                  lastSeen: Date.now(),
                });
              }
            }

            if (aircraftToTrack.length > 0) {
              // Add the active aircraft to tracked_aircraft
              await trackingDb.upsertActiveAircraftBatch(aircraftToTrack);
              console.log(
                `[Maintenance] Added ${aircraftToTrack.length} active aircraft to tracked_aircraft`
              );

              // Remove them from pending_aircraft
              const trackedIcao24s = aircraftToTrack.map((a) => a.icao24);
              await trackingDb.removePendingAircraft(trackedIcao24s);
              console.log(
                `[Maintenance] Removed ${trackedIcao24s.length} aircraft from pending_aircraft`
              );

              activeFound += aircraftToTrack.length;
            } else {
              console.log(
                `[Maintenance] No aircraft with valid positions found for ${mfg}`
              );
            }
          } else {
            console.log(
              `[Maintenance] No active aircraft found from OpenSky for ${mfg}`
            );
          }
        } else {
          console.error(
            `[Maintenance] OpenSky API error: ${response.statusText}`
          );
        }
      } catch (error) {
        console.error(`[Maintenance] Error fetching OpenSky data: ${error}`);
      }

      totalProcessed += aircraftList.length;
    }

    // Return results
    return {
      success: true,
      message: `Processed ${totalProcessed} pending aircraft, found ${activeFound} active aircraft`,
      processedCount: totalProcessed,
      activeCount: activeFound,
    };
  } catch (error) {
    console.error('[Maintenance] Error processing pending aircraft:', error);
    return {
      success: false,
      message: 'Error processing pending aircraft',
      processedCount: 0,
      activeCount: 0,
    };
  }
}

// API route handler that uses the extracted logic
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }

  // Get manufacturer if provided, otherwise process all
  const { manufacturer } = req.body;

  try {
    const result = await processPendingAircraft(manufacturer);
    return res.status(200).json(result);
  } catch (error) {
    console.error('[Maintenance] Error processing pending aircraft:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing pending aircraft',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
