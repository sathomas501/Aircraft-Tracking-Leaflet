import type { RegionCode } from '@/types/base';
import type { ExtendedAircraft } from '@/types/base';
import type { RefObject } from 'react';

export type FilterMode =
  | 'manufacturer'
  | 'geofence'
  | 'both'
  | 'owner'
  | 'region';

export interface DropdownRefs {
  filter: RefObject<HTMLDivElement>;
  manufacturer: RefObject<HTMLDivElement>;
  model: RefObject<HTMLDivElement>;
  location: RefObject<HTMLDivElement>;
  region: RefObject<HTMLDivElement>;
  owner: RefObject<HTMLDivElement>;
  actions: RefObject<HTMLDivElement>;
}

export interface FilterDropdownProps {
  toggleFilterMode: (mode: FilterMode) => void;
  selectedManufacturer: string | null;
  isGeofenceActive: boolean;
  filterMode: FilterMode | null;
  activeDropdown: string | null;
  toggleDropdown: (type: string, event: React.MouseEvent) => void;
}

export interface GeofenceState {
  geofenceLocation: string;
  geofenceRadius: number;
  isGettingLocation: boolean;
  isGeofenceActive: boolean;
  geofenceCoordinates: { lat: number; lng: number } | null;
  getUserLocation: () => Promise<void>;
  processGeofenceSearch: () => Promise<void>;
  toggleGeofenceState: (enabled: boolean) => void;
  setGeofenceLocation: (location: string) => void;
  setGeofenceRadius: (radius: number) => void;
  combinedLoading: boolean;
}

export interface ManufacturerFilterProps {
  manufacturers: Array<{ value: string; label: string }>;
  selectedManufacturer: string | null;
  manufacturerSearchTerm: string;
  setManufacturerSearchTerm: (term: string) => void;
  selectManufacturerAndClose: (value: string) => void;
  combinedLoading: boolean;
  activeDropdown: string | null;
  dropdownRef: RefObject<HTMLDivElement>;
  toggleDropdown: (type: string, event: React.MouseEvent) => void;
}

export interface OwnerFilterProps {
  activeFilters: string[];
  onFilterChange: (filters: string[]) => void;
  allOwnerTypes: string[];
  activeDropdown: string | null;
  toggleFilterMode: (mode: FilterMode) => void;
  dropdownRef: RefObject<HTMLDivElement>;
  toggleDropdown: (type: string, event: React.MouseEvent) => void;
}

export interface RegionFilterProps {
  activeRegion: RegionCode | null;
  selectedRegion: RegionCode | string | null;
  handleRegionSelect: (region: RegionCode) => void;
  applyAllFilters: () => void; // ✅ ← ADD THIS
  activeDropdown: string | null;
  toggleDropdown: (type: string, event: React.MouseEvent) => void;
  dropdownRef: RefObject<HTMLDivElement>;
}

export interface ModelOption {
  label: string;
  value: string;
  count: number;
}

export interface AircraftModel {
  MODEL: string;
  count: number;
}

export interface ModelFilterProps {
  selectedManufacturer: string | null;
  selectedModel: string | null;
  activeDropdown: string | null;
  handleModelSelect: (value: string) => void;
  toggleDropdown: (type: string, event: React.MouseEvent) => void;
  dropdownRef: RefObject<HTMLDivElement>;
  totalActive: number;
  activeModels: ModelOption[]; // ✅ updated
}

export interface RibbonProps {
  manufacturers: Array<{ value: string; label: string }>;
}

interface FilterLogicReturnType {
  // Existing properties...
  filterMode: FilterMode | null;
  activeDropdown: string | null;
  selectedManufacturer: string | null;
  selectedModel: string | null;
  geofenceLocation: string;
  geofenceRadius: number;
  geofenceCoordinates: { lat: number; lng: number } | null;
  // ... other existing properties

  // Add these missing properties
  setGeofenceCoordinates: (
    coordinates: { lat: number; lng: number } | null
  ) => void;
  setGeofenceCenter: (coordinates: { lat: number; lng: number }) => void;
  updateGeofenceAircraft: (aircraft: any[]) => void;
}
