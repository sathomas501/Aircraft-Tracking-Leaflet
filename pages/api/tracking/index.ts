// pages/api/tracking/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { TrackingDatabaseManager } from '@/lib/db/managers/trackingDatabaseManager';
import { withErrorHandler } from '@/lib/middleware/error-handler';
import { APIErrors } from '@/lib/services/error-handler/api-error';
import { OpenSkySyncService } from '../../../lib/services/openSkySyncService';
import { TrackingDataService } from '../../../lib/services/tracking-services/tracking-data-service';

interface APIResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

/**
 * Unified tracking API that handles all tracking-related operations
 */
async function handler(req: NextApiRequest, res: NextApiResponse<APIResponse>) {
  const trackingDb = TrackingDatabaseManager.getInstance();
  const trackingService = new TrackingDataService(trackingDb);
  const openSkyService = OpenSkySyncService.getInstance();

  // Handle different HTTP methods
  switch (req.method) {
    case 'GET':
      return handleGetRequests(req, res, trackingService);
    case 'POST':
      return handlePostRequests(req, res, trackingService, openSkyService);
    default:
      throw APIErrors.BadRequest('Method not allowed');
  }
}

/**
 * Handle GET requests for tracking data
 */
async function handleGetRequests(
  req: NextApiRequest,
  res: NextApiResponse<APIResponse>,
  trackingService: TrackingDataService
) {
  const { action, manufacturer } = req.query;

  switch (action) {
    case 'status':
      // Get database status
      const status = await trackingService.getDatabaseStatus();
      return res.status(200).json({
        success: true,
        message: 'Database status retrieved',
        data: status,
      });

    case 'tracked-icaos':
      // Get all tracked ICAO24 codes
      const icaos = await trackingService.getTrackedIcao24s();
      return res.status(200).json({
        success: true,
        message: `Found ${icaos.length} tracked ICAO24 codes`,
        data: {
          icaos,
          count: icaos.length,
          timestamp: Date.now(),
        },
      });

    case 'tracked-aircraft':
      // Get all tracked aircraft with optional manufacturer filter
      const manuf = typeof manufacturer === 'string' ? manufacturer : undefined;
      const aircraft = await trackingService.getTrackedAircraft(manuf);
      return res.status(200).json({
        success: true,
        message: `Found ${aircraft.length} tracked aircraft`,
        data: {
          aircraft,
          count: aircraft.length,
          timestamp: Date.now(),
        },
      });

    default:
      throw APIErrors.BadRequest(`Invalid action: ${action}`);
  }
}

/**
 * Handle POST requests for tracking operations
 */
async function handlePostRequests(
  req: NextApiRequest,
  res: NextApiResponse<APIResponse>,
  trackingService: TrackingDataService,
  openSkyService: OpenSkySyncService
) {
  const { action } = req.body;

  switch (action) {
    case 'updateBatch': {
      // Batch update aircraft positions
      const { positions } = req.body;
      if (!Array.isArray(positions)) {
        throw APIErrors.BadRequest('Invalid positions format');
      }

      const { manufacturer } = req.body;
      const updated = await trackingService.updatePositions(
        positions,
        manufacturer
      );

      return res.status(200).json({
        success: true,
        message: `Updated ${updated} aircraft positions`,
        data: { updated },
      });
    }

    case 'getTrackedAircraft': {
      // Get tracked aircraft for a manufacturer
      const { manufacturer } = req.body;
      console.log(
        `[TrackingAPI] Fetching tracked aircraft for: ${manufacturer || 'all'}`
      );

      const aircraft = await trackingService.getTrackedAircraft(manufacturer);

      return res.status(200).json({
        success: true,
        message: `Found ${aircraft.length} tracked aircraft`,
        data: { aircraft },
      });
    }

    case 'syncManufacturer': {
      // Sync a manufacturer's aircraft with OpenSky
      const { manufacturer } = req.body;
      if (!manufacturer) {
        throw APIErrors.BadRequest('Manufacturer is required');
      }

      const result = await openSkyService.syncManufacturer(manufacturer);

      return res.status(200).json({
        success: true,
        message: `Synced ${result.updated} aircraft out of ${result.total} for ${manufacturer}`,
        data: result,
      });
    }

    case 'addPendingAircraft': {
      // Add aircraft to pending tracking
      const { icao24s, manufacturer } = req.body;
      if (!Array.isArray(icao24s) || !manufacturer) {
        throw APIErrors.BadRequest('Invalid request format');
      }

      const added = await trackingService.addAircraftForTracking(
        icao24s,
        manufacturer
      );

      return res.status(200).json({
        success: true,
        message: `Added ${added} aircraft as pending for ${manufacturer}`,
        data: { added, total: icao24s.length },
      });
    }

    case 'maintenance': {
      // Run maintenance tasks
      const result = await trackingService.performMaintenance();

      return res.status(200).json({
        success: true,
        message: `Maintenance completed: marked ${result.marked} as stale, cleaned ${result.cleaned}`,
        data: result,
      });
    }

    case 'updateAircraftStatus': {
      // Update all aircraft statuses
      await trackingService.updateAircraftStatuses();

      return res.status(200).json({
        success: true,
        message: 'Aircraft statuses updated',
      });
    }

    default:
      throw APIErrors.BadRequest(`Invalid action: ${action}`);
  }
}

export default withErrorHandler(handler);
