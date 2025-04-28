// hooks/useFilterLogicAdapter.ts
import { useFilterLogic } from './useFilterLogicCompatible';
import { RegionCode } from '@/types/base';

export function useRegionFilterAdapter() {
  const {
    state,
    actions
  } = useFilterLogic();
  
  // Make sure the state structure exists before accessing it
  // Use optional chaining to safely access nested properties
  
  // Map centralized state to filter-specific props
  return {
    activeRegion: state?.filters?.region?.value || null,
    selectedRegion: state?.filters?.region?.value || null,
    handleRegionSelect: (region: RegionCode) => {
      actions?.updateFilter('region', 'value', region);
      actions?.updateFilter('region', 'active', true);
    },
    activeDropdown: state?.ui?.activeDropdown || null,
    toggleDropdown: (dropdown: string, event: React.MouseEvent) => {
      if (actions?.toggleDropdown) {
        actions.toggleDropdown(dropdown);
      }
    },
    // Safely access geofence properties with a fallback value
    isGeofenceActive: state?.filters?.geofence?.active || false,
  };
}