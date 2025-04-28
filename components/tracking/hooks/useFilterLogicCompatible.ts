// hooks/useFilterLogicCompatible.ts
import { useFilterLogicCoordinator } from './useFilterLogicCoordinator';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import { FilterState, FilterMode } from '../types/filterState';

export function useFilterLogic() {
  const coordinator = useFilterLogicCoordinator();
  const mapContext = useEnhancedMapContext();
  
  // Create a complete state object matching FilterState interface
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
        aircraft: [], // Initialize with empty array or actual aircraft data if available
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
  };
  
  // Create actions object
  const actions = {
    updateFilter: (filterName: string, key: string, value: any) => {
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
        }
      }
      // Handle other filter types...
    },
    toggleDropdown: (dropdown: string) => {
      coordinator.toggleDropdown(dropdown, { stopPropagation: () => {} } as any);
    },
    // Add other actions...
  };
  
  return {
    ...coordinator,
    state,
    actions,
    isRefreshing: false, // Or get from coordinator if available
    localLoading: coordinator.combinedLoading || false,
    updateGeofenceAircraft: mapContext.updateGeofenceAircraft,
    refreshWithFilters: () => {
      if (typeof mapContext.refreshPositions === 'function') {
        mapContext.refreshPositions().catch((error: unknown) => {
          console.error('Error refreshing positions:', error);
        });
      }
    },
    isGeofencePlacementMode: false,
  };
}