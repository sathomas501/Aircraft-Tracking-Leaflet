// components/tracking/types/filters.ts
import type { RegionCode } from '@/types/base';
import type { ExtendedAircraft } from '@/types/base';
import type { RefObject } from 'react';

export type FilterMode =
  | 'manufacturer'
  | 'geofence'
  | 'both'
  | 'owner'
  | 'region'
  | 'AND'
  | 'NOT'
  | 'OR';


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
  disabled?: boolean;
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
  handleManufacturerSelect: (value: string) => void;

  // Update this type to match what's being passed
  activeRegion: RegionCode | string | null;
  // Add regionCounts
  regionCounts: {
    totalActive: number;
    manufacturerCount: number;
    modelCount: number;
    selectedManufacturerCount: number;
    selectedModelCount: number;
  } | null;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  // Error handling callback
  onError?: (message: string) => void;
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
  handleRegionSelect: (region: RegionCode) => void;
  activeDropdown: string | null;
  toggleDropdown: (dropdown: string, event: React.MouseEvent) => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
  selectedRegion: number;
  activeRegion: string | RegionCode | null; // Add activeRegion to props
  isGeofenceActive?: boolean;
}

export interface ModelFilterProps {
  selectedModel: string | null;
  handleModelSelect: (value: string) => void;
  activeDropdown: string | null;
  toggleDropdown: (dropdown: string, event: React.MouseEvent) => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
  modelOptions: Array<{ name: string; count: number }> | null;
  // Update this type to match what's being passed
  activeRegion: RegionCode | string | null;
  // Add regionCounts
  regionCounts: {
    totalActive: number;
    manufacturerCount: number;
    modelCount: number;
    selectedManufacturerCount: number;
    selectedModelCount: number;
  } | null;
}

// Make sure ModelOption and FilterBarModelOption match
export interface ModelOption {
  name: string;
  count: number; 
}

export interface RibbonProps {
  notification: string | null;
  lastUpdated: string | null;
  type?: 'info' | 'warning' | 'error';
}

export interface FilterLogicReturnType {
  // State
  filterMode: FilterMode | null;
  activeDropdown: string | null;
  selectedManufacturer: string | null;
  selectedModel: string | null;
  modelOptions?: Array<{ name: string; count: number }> | null;
  geofenceLocation: string;
  geofenceRadius: number;
  regionCounts: {
    totalActive: number;
    manufacturerCount: number;
    modelCount: number;
    selectedManufacturerCount: number;
    selectedModelCount: number;
  };
  isGeofenceActive: boolean;
  geofenceCoordinates: { lat: number; lng: number } | null;
  activeRegion: RegionCode | string | null;
  ownerFilters: string[];
  allOwnerTypes: string[];
  manufacturerSearchTerm: string;
  isGettingLocation: boolean;
  dropdownRefs: DropdownRefs;
  localLoading: boolean;
  isRateLimited: boolean;
  selectedRegion: number;
  isRefreshing: boolean;
  isGeofencePlacementMode: boolean;
  lastUpdated: string | null;
  quotaUsage: { used: number; total: number };
  notification: string | null;
  showLiveData: boolean;
  isLoading: boolean;
  totalActive: number;
  combinedLoading: boolean;
  
  // Data
  manufacturers: Array<{ name: string; count: number }>;
  models: Array<{ name: string; count: number }>;
  
  // Methods
  toggleDropdown: (dropdown: string, event: React.MouseEvent) => void;
  toggleFilterMode: (mode: FilterMode) => void;
  selectManufacturerAndClose: (value: string) => void;
  handleModelSelect: (value: string) => void;
  processGeofenceSearch: () => Promise<void>;
  handleOwnerFilterChange: (filters: string[]) => void;
  setOwnerFilters: (filters: string[]) => void;
  setIsGeofenceActive: (active: boolean) => void;
  setActiveRegion: (region: RegionCode | string | null) => void;
  handleRegionSelect: (region: RegionCode) => void;
  handleManufacturerSelect: (value: string) => void;
  setManufacturerSearchTerm: (term: string) => void;
  setSelectedManufacturer:(dropdown: string | null) => void;
  setFilterMode:(mode: FilterMode) => void;
  setGeofenceLocation: (location: string) => void;
  setIsGeofencePlacementMode:(active: boolean) => void;
  setGeofenceRadius: (radius: number) => void;
  toggleGeofenceState: (active: boolean) => void;
  toggleGeofenceActive:(active: boolean) => void;
  clearAllFilters: () => void;
  setGeofenceCoordinates: (coordinates: { lat: number; lng: number } | null) => void;
  setIsGeofenceLocationMode:(active: boolean) => void;
  setGeofenceCenter: (coordinates: { lat: number; lng: number }) => void;
  setIsGettingLocation: (isGetting: boolean) => void;
  updateGeofenceAircraft: (aircraft: any[]) => void;
  getUserLocation: () => Promise<void>;
  setActiveDropdown: (dropdown: string | null) => void;
  applyFilters: (aircraft: ExtendedAircraft[]) => ExtendedAircraft[];
  refreshWithFilters: () => void;
  setSelectedModel: (dropdown: string | null) => void;
}

export interface FilterBarProps {
  modelOptions?: Array<{ name: string; count: number }> | null;
  regionCounts?: any;
  activeRegion?: any;
}

export interface FilterBarModelOption {
  name: string;
  // Add count property to match ModelOption
  count: number;
}

export interface FilterModeSelectorProps {
  id: string;
  label: string | React.ReactNode;
  icon: React.ReactNode;
  isFiltered: boolean;
  disabled: boolean;
  children?: React.ReactNode; // Added children property
  className?: string;
}

export interface GeofenceFilterProps {
  geofenceLocation: string;
  geofenceRadius: number;
  isGettingLocation: boolean;
  isGeofenceActive: boolean;
  geofenceCoordinates: { lat: number; lng: number } | null;
  getUserLocation: () => Promise<void>;
  processGeofenceSearch: () => void;
  toggleGeofenceState: (active: boolean) => void;
  setGeofenceLocation: (location: string) => void;
  setGeofenceRadius: (radius: number) => void;
  setGeofenceCoordinates: (coordinates: { lat: number; lng: number } | null) => void;
  setGeofenceCenter: (center: { lat: number; lng: number }) => void;
  updateGeofenceAircraft: () => void;
  combinedLoading: boolean;
  activeDropdown: string | null;
  setActiveDropdown: (dropdown: string | null) => void;
  toggleDropdown: (dropdown: string, event: React.MouseEvent) => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
  isGeofencePlacementMode: boolean;
  setIsGettingLocation: (isGetting: boolean) => void;
}