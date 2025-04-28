import { useState, useRef, useEffect } from 'react';
import { ExtendedAircraft } from '@/types/base';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';



export function useOwnerLogic() {
  // Get context state and functions
  const {
    selectedManufacturer,
    selectedModel,
    refreshPositions,

  } = useEnhancedMapContext();


  // Local state
  const [localLoading, setLocalLoading] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [manufacturerSearchTerm, setManufacturerSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Combined mode state
  const [combinedModeReady, setCombinedModeReady] = useState<boolean>(false);

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

  const [ownerFilters, setOwnerFilters] = useState<string[]>([
    ...allOwnerTypes,
  ]);

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
  };

  const handleOwnerFilterChange = (updatedFilters: string[]) => {
    setOwnerFilters(updatedFilters);
    // Apply the filter to your aircraft data
    applyOwnerTypeFilter(updatedFilters);
  };

  const resetOwnerFilters = () => {
    setOwnerFilters([...allOwnerTypes]);
  };

    // 5. Reset owner filters to select all
    setOwnerFilters([...allOwnerTypes]);

    
  return {
    // State
    activeDropdown,
    selectedManufacturer,
    selectedModel,
      ownerFilters,
    allOwnerTypes,
    manufacturerSearchTerm,
    localLoading,
    isRefreshing,
    isGeofencePlacementMode: false, // Initialize with a default value

    // Methods
    handleOwnerFilterChange,
    setManufacturerSearchTerm,
    applyCombinedFilters,
    getAircraftOwnerType,


    refreshWithFilters: () => {
      // Implement refresh logic here
      if (typeof refreshPositions === 'function') {
        refreshPositions()
          .catch((error: unknown) => {
            console.error('Error refreshing positions:', error);
          });
      }
    },
    setActiveDropdown, // Add this line if you have this function
  };
}

function applyCombinedFilters() {
  throw new Error('Function not implemented.');
}
