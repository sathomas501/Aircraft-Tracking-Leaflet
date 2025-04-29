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
      hasError?: string | null; // Added hasError property
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
  geofencePanel: {
      show:  boolean;
      position: { x: number; y: number } | null;
      tempCoordinates: { lat: number; lng: number } | null;
      locationName: string | null;
      isLoading:  boolean;
  };
}


// Removed duplicate declaration of RegionFilterState

export interface ManufacturerFilterState {
  active: boolean;
  value: string | null;
  model: string | null;
  searchTerm: string;
}

export interface GeofenceFilterState {
  active: boolean;
  location: string;
  radius: number;
  coordinates: { lat: number; lng: number } | null;
  isGettingLocation: boolean;
  aircraft: ExtendedAircraft[];
  hasError?: string | null; // Added hasError property
}

export interface OwnerFilterState {
  active: boolean;
  selectedTypes: string[];
}

export interface UIState {
  activeDropdown: string | null;
  filterMode: FilterMode;
  loading: boolean;
  isRateLimited: boolean;
  rateLimitTimer: number | null;
}

export interface PanelState {
  show: boolean;
  position: { x: number; y: number } | null;
  tempCoordinates: { lat: number; lng: number } | null;
  locationName: string | null;
  isLoading: boolean;
}
