// components/tracking/filters/filterProps.ts
import React from 'react';
import { FilterMode } from '../../types/filters';
import { RegionCode } from '@/types/base';

// RegionFilter Props
export interface RegionFilterProps {
  activeRegion: RegionCode | string | null;
  handleRegionSelect: (region: RegionCode) => void;
  activeDropdown: string | null;
  toggleDropdown: (dropdown: string, event: React.MouseEvent) => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
  selectedRegion: number;
}

// ManufacturerFilter Props
export interface ManufacturerFilterProps {
  selectedManufacturer: string | null;
  handleManufacturerSelect: (value: string) => void;
  activeDropdown: string | null;
  toggleDropdown: (dropdown: string, event: React.MouseEvent) => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
  manufacturers: Array<{ name: string; count: number }>;
  combinedLoading: boolean;
  manufacturerSearchTerm: string;
  setManufacturerSearchTerm: (term: string) => void;
  activeRegion: RegionCode | string | null;
  regionCounts: {
    totalActive: number;
    manufacturerCount: number;
    modelCount: number;
    selectedManufacturerCount: number;
    selectedModelCount: number;
  };
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

// ModelFilter Props
export interface ModelFilterProps {
  selectedModel: string | null;
  handleModelSelect: (value: string) => void;
  activeDropdown: string | null;
  toggleDropdown: (dropdown: string, event: React.MouseEvent) => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
  modelOptions: Array<{ name: string; count: number }>;
  activeRegion: RegionCode | string | null;
  regionCounts: {
    totalActive: number;
    manufacturerCount: number;
    modelCount: number;
    selectedManufacturerCount: number;
    selectedModelCount: number;
  };
}

// OwnerFilter Props
export interface OwnerFilterProps {
  activeFilters: string[];
  onFilterChange: (filters: string[]) => void;
  allOwnerTypes: string[];
  activeDropdown: string | null;
  toggleFilterMode: (mode: FilterMode) => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
  toggleDropdown: (dropdown: string, event: React.MouseEvent) => void;
}

// GeofenceFilter Props
export interface GeofenceFilterProps {
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
  activeDropdown: string | null;
  toggleDropdown: (dropdown: string, event: React.MouseEvent) => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
  setGeofenceCoordinates: (coordinates: { lat: number; lng: number } | null) => void;
  setIsGettingLocation: (isGetting: boolean) => void;
}