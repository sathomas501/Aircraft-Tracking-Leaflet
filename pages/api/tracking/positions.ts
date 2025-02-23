// pages/api/tracking/positions.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { TrackingDatabaseManager } from '@/lib/db/managers/trackingDatabaseManager';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { APIErrors } from '@/lib/services/error-handler/api-error';
import type { Aircraft } from '@/types/base';

interface PositionUpdate {
  icao24: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  velocity?: number;
  heading?: number;
  on_ground?: boolean;
  last_contact?: number;
  manufacturer?: string;
}

interface APIResponse {
  success: boolean;
  message: string;
  data?: {
    newICAOs?: string[];
    existingICAOs?: string[];
    updated?: number;
    aircraft?: Aircraft[];
  };
}

async function handler(req: NextApiRequest, res: NextApiResponse<APIResponse>) {
  if (req.method !== 'POST') {
    throw APIErrors.BadRequest('Method not allowed');
  }

  const { action } = req.body;
  const trackingDb = TrackingDatabaseManager.getInstance();

  try {
    switch (action) {
      case 'updateBatch': {
        const { positions } = req.body;
        if (!Array.isArray(positions)) {
          throw APIErrors.BadRequest('Invalid positions format');
        }

        const aircraftData: Aircraft[] = positions.map(
          (pos: PositionUpdate) => ({
            icao24: pos.icao24,
            latitude: pos.latitude,
            longitude: pos.longitude,
            altitude: pos.altitude || 0,
            velocity: pos.velocity || 0,
            heading: pos.heading || 0,
            on_ground: pos.on_ground || false,
            last_contact: pos.last_contact || Math.floor(Date.now() / 1000),
            manufacturer: pos.manufacturer || '',
            isTracked: true,
            'N-NUMBER': '',
            model: '',
            TYPE_AIRCRAFT: '',
            OWNER_TYPE: '',
            NAME: '',
            CITY: '',
            STATE: '',
          })
        );

        const updated =
          await trackingDb.upsertActiveAircraftBatch(aircraftData);

        return res.status(200).json({
          success: true,
          message: `Updated ${updated} aircraft positions`,
          data: { updated },
        });
      }

      case 'getTrackedAircraft': {
        // ✅ FIXED CASE STATEMENT
        const { manufacturer } = req.body;
        if (!manufacturer) {
          throw APIErrors.BadRequest('Manufacturer is required');
        }

        console.log(
          `[TrackingAPI] Fetching tracked aircraft for: ${manufacturer}`
        );

        const aircraft = await trackingDb.getTrackedAircraft(manufacturer);

        return res.status(200).json({
          success: true,
          message: `Found ${aircraft.length} tracked aircraft`,
          data: { aircraft },
        });
      }

      case 'initializeMap': {
        // Return empty success for initial map load
        return res.status(200).json({
          success: true,
          message: 'Map initialized',
          data: {
            aircraft: [], // Empty initial state
          },
        });
      }

      case 'getTrackedAircraft': {
        const { manufacturer } = req.body;
        // Allow empty manufacturer for initial state
        if (!manufacturer) {
          return res.status(200).json({
            success: true,
            message: 'No manufacturer selected',
            data: {
              aircraft: [],
            },
          });
        }

        return res.status(200).json({
          success: true,
          message: 'No manufacturer selected',
          data: {
            aircraft: [],
          },
        });
      }

      default:
        throw APIErrors.BadRequest(`Invalid action: ${action}`);
    }
  } catch (error) {
    console.error('[TrackingAPI] Error processing request:', error);
    throw APIErrors.Internal(
      error instanceof Error ? error : new Error('Unknown error')
    );
  }
}

export default withErrorHandler(handler);
