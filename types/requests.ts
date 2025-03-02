import { OpenSkyStateArray } from './base';

export interface BatchUpdate {
  positions: OpenSkyStateArray[]; // Keep existing structure
  manufacturer: string; // ✅ Add manufacturer field
}
