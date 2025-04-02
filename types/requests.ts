import { OpenSkyStateArray } from './base';

export interface BatchUpdate {
  positions: OpenSkyStateArray[]; // Keep existing structure
  MANUFACTURER: string; // ✅ Add MANUFACTURER field
}
