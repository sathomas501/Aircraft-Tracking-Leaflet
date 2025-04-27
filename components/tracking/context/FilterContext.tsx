// components/tracking/context/FilterContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { useFilterLogic } from '../hooks/useFilterLogic';
import type { FilterLogicReturnType } from '../types/filters';

// Create the context
const FilterContext = createContext<FilterLogicReturnType | undefined>(
  undefined
);

// Create provider component
interface FilterProviderProps {
  children: ReactNode;
}

export const FilterProvider: React.FC<FilterProviderProps> = ({ children }) => {
  // Use the filter logic hook to get all the state and methods
  const filterLogic = useFilterLogic();

  return (
    <FilterContext.Provider value={filterLogic}>
      {children}
    </FilterContext.Provider>
  );
};

// Custom hook to use the filter context
export const useFilterContext = (): FilterLogicReturnType => {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilterContext must be used within a FilterProvider');
  }
  return context;
};

// Re-export useFilterLogic for direct access when needed
export { useFilterLogic };
