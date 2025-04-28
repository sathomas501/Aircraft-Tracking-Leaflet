// hooks/useOwnerFilterLogic.ts
import { ExtendedAircraft } from '@/types/base';
import { useCentralFilterState } from '../context/CentralizedFilterContext';

interface UseOwnerFilterLogicProps {
  displayedAircraft: ExtendedAircraft[];
  activeDropdown: string | null;
  setActiveDropdown: (dropdown: string | null) => void;
  updateGeofenceAircraft: (aircraft: ExtendedAircraft[]) => void;
  clearGeofenceData: () => void;
}

interface UseOwnerFilterLogicReturn {
  ownerFilters: string[];
  allOwnerTypes: string[];
  handleOwnerFilterChange: (updatedFilters: string[]) => void;
  resetOwnerFilters: () => void;
  getAircraftOwnerType: (aircraft: ExtendedAircraft) => string;
  applyOwnerTypeFilter: (filters: string[]) => void;
}

export function useOwnerFilterLogic({
  displayedAircraft,
  updateGeofenceAircraft,
  clearGeofenceData
}: UseOwnerFilterLogicProps): UseOwnerFilterLogicReturn {
  // Use the central state instead of local state
  const { state, updateFilter } = useCentralFilterState();
  
  // Access centralized state
  const ownerFilters = state.filters.owner.selectedTypes;

  // Owner filter state
  const allOwnerTypes = [
    'individual',
    'partnership',
    'corp-owner',
    'co-owned',
    'llc',
    'non-citizen-corp',
    'airline',
    'freight',
    'medical',
    'media',
    'historical',
    'flying-club',
    'emergency',
    'local-govt',
    'education',
    'federal-govt',
    'flight-school',
    'leasing-corp',
    'military',
    'unknown',
  ];

  // Owner filter methods
  const getAircraftOwnerType = (aircraft: ExtendedAircraft): string => {
    const ownerType = aircraft.TYPE_REGISTRANT || 0;
    return ownerTypeToString(ownerType);
  };

  const ownerTypeToString = (type: number | string): string => {
    const typeNum = typeof type === 'string' ? parseInt(type, 10) : type;

    const ownerTypeMap: Record<number, string> = {
      1: 'individual',
      2: 'partnership',
      3: 'corp-owner',
      4: 'co-owned',
      7: 'llc',
      8: 'non-citizen-corp',
      9: 'airline',
      10: 'freight',
      11: 'medical',
      12: 'media',
      13: 'historical',
      14: 'flying-club',
      15: 'emergency',
      16: 'local-govt',
      17: 'education',
      18: 'federal-govt',
      19: 'flight-school',
      20: 'leasing-corp',
      21: 'military',
    };

    return ownerTypeMap[typeNum] || 'unknown';
  };

  const applyOwnerTypeFilter = (filters: string[]) => {
    // Skip filtering if all types are selected or none are selected
    if (filters.length === 0 || filters.length === allOwnerTypes.length) {
      return;
    }

    // Filter the aircraft based on selected owner types
    if (displayedAircraft && displayedAircraft.length > 0) {
      const filteredAircraft = displayedAircraft.filter((aircraft) => {
        const ownerType = getAircraftOwnerType(aircraft);
        return filters.includes(ownerType);
      });

      // Update the displayed aircraft
      if (clearGeofenceData) {
        clearGeofenceData();
      }
      updateGeofenceAircraft(filteredAircraft);
    }
  };

  const handleOwnerFilterChange = (updatedFilters: string[]) => {
    // Update the central state instead of local state
    updateFilter('owner', 'selectedTypes', updatedFilters);
    applyOwnerTypeFilter(updatedFilters);
  };

  const resetOwnerFilters = () => {
    // Update central state instead of using the old setOwnerFilters
    updateFilter('owner', 'selectedTypes', [...allOwnerTypes]);
  };

  return {
    ownerFilters,
    allOwnerTypes,
    handleOwnerFilterChange,
    resetOwnerFilters,
    getAircraftOwnerType,
    applyOwnerTypeFilter
  };
}