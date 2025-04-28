// hooks/useFilterState.ts - Core state management
import { useState } from 'react';
import { FilterState } from '../types/filterState';

export function useFilterState() {
  const [state, setState] = useState<FilterState>({
    // Initialize with your default values
  });

  // Core state update methods
  const updateFilter = (filterName, key, value) => {
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

  // Other general state methods
  
  return {
    state,
    updateFilter,
    // Other methods
  };
}