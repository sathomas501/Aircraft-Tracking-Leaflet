// In /types/tracking.ts or create new file if doesn't exist\
import { Aircraft } from './base';

export interface TrackingUpdateRequest {
  action:
    | 'updatePositions'
    | 'getTrackedAircraft'
    | 'removeAircraft'
    | 'fetchAndStoreActiveAircraft'
    | 'upsertActiveAircraftBatch';
  MANUFACTURER?: string;
  positions?: Aircraft[];
  aircraft?: Aircraft[];
  ICAO24s?: string[];
  ICAO24?: string;
}
