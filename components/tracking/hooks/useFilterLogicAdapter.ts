// hooks/useFilterLogicAdapter.ts
import { useFilterLogic } from './useFilterLogic'; // Your new centralized state
import { RegionCode } from '@/types/base';

export function useRegionFilterAdapter() {
  const { 
    state, 
    actions 
  } = useFilterLogic();
  
  // Map centralized state to filter-specific props
  return {
    activeRegion: state.filters.region.value,
    selectedRegion: state.filters.region.value,
    handleRegionSelect: (region: RegionCode) => {
      actions.updateFilter('region', region);
    },
    activeDropdown: state.ui.activeDropdown,
    toggleDropdown: (dropdown: string, event: React.MouseEvent) => {
      actions.toggleDropdown(dropdown);
    },
    isGeofenceActive: state.filters.geofence.active,
  };
}