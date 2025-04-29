// hooks/useFilterLogicCompatible.ts
import { useFilterLogicCoordinator } from './useFilterLogicCoordinator';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import { 
  FilterState, 
  FilterMode, 
  PanelState 
} from '../types/filterState';
import { RegionCode } from '@/types/base';
import { useCentralFilterState } from '../context/CentralizedFilterContext';

// Expanded FilterState interface with all necessary properties
export interface EnhancedFilterState extends FilterState {
  geofencePanel: PanelState;
}

export function useFilterLogic() {
  const coordinator = useFilterLogicCoordinator();
  const mapContext = useEnhancedMapContext();
  const { updateFilter, updateUIState, setActiveDropdown } = useCentralFilterState();
  
  // Create a complete state object matching Enhanced FilterState interface
  const state: FilterState = {
    filters: {
      region: {
        active: !!coordinator.activeRegion,
        value: coordinator.activeRegion,
        selectedRegion: typeof coordinator.selectedRegion === 'number' ? coordinator.selectedRegion : 0,
      },
      manufacturer: {
        active: !!coordinator.selectedManufacturer,
        value: coordinator.selectedManufacturer,
        model: coordinator.selectedModel,
        searchTerm: coordinator.manufacturerSearchTerm || '',
      },
      geofence: {
        active: coordinator.isGeofenceActive || false,
        location: coordinator.geofenceLocation || '',
        radius: coordinator.geofenceRadius || 25,
        coordinates: coordinator.geofenceCoordinates,
        isGettingLocation: coordinator.isGettingLocation || false,
        aircraft: coordinator.geofenceAircraft || [],
        hasError: coordinator.hasError // Using the added property
      },
      owner: {
        active: !!coordinator.ownerFilters?.length,
        selectedTypes: coordinator.ownerFilters || [],
      },
    },
    ui: {
      activeDropdown: coordinator.activeDropdown,
      filterMode: coordinator.filterMode as FilterMode,
      loading: coordinator.combinedLoading || false,
      isRateLimited: coordinator.isRateLimited || false,
      rateLimitTimer: coordinator.rateLimitTimer || null,
    },
    geofencePanel: {
      show: coordinator.showGeofencePanel || false,
      position: coordinator.geofencePanelPosition,
      tempCoordinates: coordinator.tempCoordinates,
      locationName: coordinator.locationName,
      isLoading: coordinator.isLoadingLocation || false,
    }
  };
  
  // Create actions object with all filter operations
  const actions = {
    // FilterState actions
    updateFilter: (filterName: "manufacturer" | "geofence" | "owner" | "region", key: string, value: any) => {
      // Handle different filter types
      if (filterName === 'region' && key === 'value') {
        coordinator.handleRegionSelect(value);
      } else if (filterName === 'manufacturer' && key === 'value') {
        coordinator.selectManufacturerAndClose(value);
      } else if (filterName === 'geofence') {
        // Handle geofence updates
        if (key === 'active') {
          coordinator.toggleGeofenceState(value);
        } else if (key === 'location') {
          coordinator.setGeofenceLocation(value);
        } else if (key === 'radius') {
          coordinator.setGeofenceRadius(value);
        } else if (key === 'coordinates') {
          coordinator.setGeofenceCoordinates(value);
        }
      } else if (filterName === 'owner' && key === 'selectedTypes') {
        // Call coordinator method to update owner filters
      }
      
      // Pass through to centralized state if available
      if (updateFilter) {
        updateFilter(filterName, key, value);
      }
    },
    
    // UI actions
    toggleDropdown: (dropdown: string) => {
      coordinator.toggleDropdown(dropdown, { stopPropagation: () => {} } as any);
      if (setActiveDropdown) {
        setActiveDropdown(dropdown);
      }
    },
    
    setFilterMode: (mode: FilterMode) => {
      coordinator.toggleFilterMode(mode);
      if (updateUIState) {
        updateUIState('filterMode', mode);
      }
    },
    
    // Geofence specific actions
    getGeofenceUserLocation: () => {
      return coordinator.getUserLocation();
    },
    
    processGeofenceSearch: (fromPanel = false) => {
      return coordinator.processGeofenceSearch(fromPanel);
    },
    
    clearGeofenceData: () => {
      if (coordinator.clearGeofenceData) {
        coordinator.clearGeofenceData();
      }
      // Update centralized state
      if (updateFilter) {
        updateFilter('geofence', 'active', false);
        updateFilter('geofence', 'coordinates', null);
        updateFilter('geofence', 'location', '');
      }
    },
    
    // Panel actions
    openGeofencePanel: (position: { x: number, y: number }) => {
      coordinator.openGeofencePanel(position);
    },
    
    closeGeofencePanel: () => {
      coordinator.closeGeofencePanel();
    },
    
    resetGeofencePanel: () => {
      coordinator.resetGeofencePanel();
    },
    
    handlePanelSearch: (lat: number, lng: number) => {
      return coordinator.handlePanelSearch(lat, lng);
    },
    
    // Global actions
    clearAllFilters: () => {
      coordinator.clearAllFilters();
      // Update centralized state
      if (updateFilter && updateUIState) {
        // Reset all filter states in the centralized store
        updateFilter('region', 'active', false);
        updateFilter('manufacturer', 'active', false);
        updateFilter('geofence', 'active', false);
        updateFilter('owner', 'active', false);
        updateUIState('filterMode', 'manufacturer');
      }
    },
    
    refreshFilters: () => {
      coordinator.refreshWithFilters();
    }
  };
  
  return {
    ...coordinator,
    state,
    actions,
    isRefreshing: coordinator.combinedLoading || false,
    localLoading: coordinator.combinedLoading || false,
    
    // Compatibility layer for direct access to methods
    updateGeofenceAircraft: mapContext.updateGeofenceAircraft,
    
    refreshWithFilters: () => {
      if (typeof mapContext.refreshPositions === 'function') {
        mapContext.refreshPositions().catch((error: unknown) => {
          console.error('Error refreshing positions:', error);
        });
      }
    },
    
    isGeofencePlacementMode: false,
    
    // Region select handler with compatibility fallback
    handleRegionSelect: async (region: RegionCode): Promise<void> => {
      if (coordinator.handleRegionSelect) {
        return coordinator.handleRegionSelect(region);
      }
      // Fallback that won't work as well without map instance
      else {
        updateFilter('region', 'value', region);
        updateFilter('region', 'selectedRegion', region);
        updateFilter('region', 'active', true);
        setActiveDropdown(null);
        return Promise.resolve();
      }
    }
  };
}