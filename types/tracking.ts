// In /types/tracking.ts or create new file if doesn't exist\
import { Aircraft } from './base';

export interface TrackingUpdateRequest {
  action:
    | 'updatePositions'
    | 'getTrackedAircraft'
    | 'removeAircraft'
    | 'fetchAndStoreActiveAircraft'
    | 'upsertActiveAircraftBatch';
  manufacturer?: string;
  positions?: Aircraft[];
  aircraft?: Aircraft[];
  icao24s?: string[];
  icao24?: string;
}
