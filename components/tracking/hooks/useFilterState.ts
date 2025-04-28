// hooks/useFilterState.ts - Core state management
import { useState } from 'react';
import { FilterState, FilterMode } from '../types/filterState';
import { RegionCode } from '@/types/base';
import { useFilterLogicCoordinator } from './useFilterLogicCoordinator';

// Create this type in your filterState.ts file:
export type FilterLogicReturnType = ReturnType<typeof useFilterLogicCoordinator>;

// Define the filter state structure
export interface LocalFilterState {
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
    };
    owner: {
      active: boolean;
      selectedTypes: string[];
    };
  };
  ui: {
    activeDropdown: string | null;
    filterMode: string | null;
    loading: boolean;
    isRateLimited: boolean;
    rateLimitTimer: number | null;
  };
}

// Define initial state
const initialState: LocalFilterState = {
  filters: {
    region: {
      active: false,
      value: null,
      selectedRegion: 0, // Use your RegionCode.GLOBAL value here
    },
    manufacturer: {
      active: false,
      value: null,
      model: null,
      searchTerm: '',
    },
    geofence: {
      active: false,
      location: '',
      radius: 25,
      coordinates: null,
      isGettingLocation: false,
    },
    owner: {
      active: false,
      selectedTypes: [],
    },
  },
  ui: {
    activeDropdown: null,
    filterMode: null,
    loading: false,
    isRateLimited: false,
    rateLimitTimer: null,
  },
};

export function useFilterState() {
  const [state, setState] = useState<LocalFilterState>(initialState);

  // Core state update methods
  const updateFilter = (
    filterName: keyof FilterState['filters'], 
    key: string, 
    value: any
  ) => {
    setState(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        [filterName]: {
          ...prev.filters[filterName],
          [key]: value,
        }
      }
    }));
  };

  // Add more state management method

// UI state update methods
  const updateUIState = (key: string, value: any) => {
  setState(prev => ({
    ...prev,
    ui: {
      ...prev.ui,
      [key]: value
    }
  }));
};


  const setActiveDropdown = (dropdown: string | null) => {
    updateUIState('activeDropdown', dropdown);
  };

  const setFilterMode = (mode: FilterMode | null) => {
    updateUIState('filterMode', mode);
  };

  const setLoading = (isLoading: boolean) => {
  updateUIState('loading', isLoading);
};

  const resetFilters = () => {
    setState(initialState);
  };

  return {
    state,
    updateFilter,
    updateUIState,
    setActiveDropdown,
    setFilterMode,
    setLoading,
    resetFilters
  };
}