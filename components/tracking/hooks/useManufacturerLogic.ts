import { useState, useRef, useEffect } from 'react';
import React from 'react';
import {useEnhancedMapContext} from '../context/EnhancedMapContext'
import type { ExtendedAircraft } from '@/types/base';


export function useManufacturerLogic() {
  // Get context state and functions
  const {
    selectedManufacturer,
    selectedModel,
    selectManufacturer,
    selectModel,
    refreshPositions,
    blockManufacturerApiCalls,
    setBlockManufacturerApiCalls,
    isManufacturerApiBlocked,
    setIsManufacturerApiBlocked,

    displayedAircraft,
  } = useEnhancedMapContext();

 const [localLoading, setLocalLoading] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [manufacturerSearchTerm, setManufacturerSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [rateLimitTimer, setRateLimitTimer] = useState<number | null>(null);



  // Manufacturer filter methods
  const selectManufacturerAndClose = (value: string) => {
    // Close dropdown

    setManufacturerSearchTerm('');

    // If clearing the selection
    if (value === '') {
      selectManufacturer(null);
      return;
    }

    // Set the manufacturer selection
    selectManufacturer(value);

      fetchManufacturerData(value);
    }
  };

  const fetchManufacturerData = (manufacturer: string) => {

    console.log(`Fetching data for manufacturer: ${manufacturer}`);

    try {
      // If you have a context function for this, call it after a slight delay
      if (typeof refreshPositions === 'function') {
        // Apply a small delay to prevent overwhelming the API
        setTimeout(() => {
          refreshPositions().catch((error: any) => {
            if (error.message?.includes('rate limit') || error.status === 429) {
              handleRateLimit(30);
            } else {
              console.error('Error fetching manufacturer data:', error);
            }
          });
        }, 200);
      }
    } catch (error: any) {
      if (error.message?.includes('rate limit') || error.status === 429) {
        handleRateLimit(30);
      } else {
        console.error('Error scheduling manufacturer data fetch:', error);
      }
    }
  };


  // Model selection methods
  const handleModelSelect = (value: string) => {
    selectModel(value === '' ? null : value);
    setActiveDropdown(null);

    // If in combined mode, reapply the filter
    if (filterMode === 'both' && isGeofenceActive && selectedManufacturer) {
      setTimeout(() => {
        applyCombinedFilters();
      }, 100);
    }
  };


  // Reset all filters
  const clearAllFilters = () => {
    console.log('Clearing all filters...');

    // 1. Reset filter mode
    setFilterMode('manufacturer');

    // 2. Unblock API calls that might have been blocked
    openSkyTrackingService.setBlockAllApiCalls(false);
    setBlockManufacturerApiCalls(false);
    setIsManufacturerApiBlocked(false);

    // 3. Clear manufacturer selection
    selectManufacturer(null);
    selectModel(null);

    // Add this line to clear locationName
    setLocationName(null); // or setLocationName('') depending on how you handle empty states

    // 12. Reset search terms
    setManufacturerSearchTerm('');

  return {
    // State

    isGeofencePlacementMode: false, // Initialize with a default value

    // Methods

    handleModelSelect,

    clearAllFilters,


    refreshWithFilters: () => {
      // Implement refresh logic here
      if (typeof refreshPositions === 'function') {
        refreshPositions().catch((error) => {
          console.error('Error refreshing positions:', error);
        });
      }
    },
    setActiveDropdown, // Add this line if you have this function
  };
}
