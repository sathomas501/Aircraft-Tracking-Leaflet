// types/filterState.ts
import { ExtendedAircraft, RegionCode } from "@/types/base";

// Add this to filterState.ts
export type FilterMode = 'manufacturer' | 'geofence' | 'both' | 'owner' | 'region';

export interface FilterState {
  filters: {
    region: {
      active: boolean;
      value: RegionCode | string | null;
      selectedRegion: number;
    };
    manufacturer: {
      active: boolean;
      value: string | null;
      model: string | null;
      searchTerm: string;
    };
    geofence: {
      active: boolean;
      location: string;
      radius: number;
      coordinates: { lat: number; lng: number } | null;
      isGettingLocation: boolean;
      aircraft: ExtendedAircraft[];
    };
    owner: {
      active: boolean;
      selectedTypes: string[];
    };
  };
  ui: {
    activeDropdown: string | null;
    filterMode: FilterMode | null;
    loading: boolean;
    isRateLimited: boolean;
    rateLimitTimer: number | null;
  };
}

