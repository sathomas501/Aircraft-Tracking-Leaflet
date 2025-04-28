// context/CentralizedFilterContext.tsx
import React, { createContext, useContext } from 'react';
import { useFilterState } from '../hooks/useFilterState';
import { FilterState, FilterMode } from '../types/filterState';

type CentralFilterStateType = ReturnType<typeof useFilterState>;

const CentralFilterStateContext = createContext<
  CentralFilterStateType | undefined
>(undefined);

export const CentralFilterStateProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const filterState = useFilterState();

  return (
    <CentralFilterStateContext.Provider value={filterState}>
      {children}
    </CentralFilterStateContext.Provider>
  );
};

export const useCentralFilterState = () => {
  const context = useContext(CentralFilterStateContext);
  if (context === undefined) {
    throw new Error(
      'useCentralFilterState must be used within a CentralFilterStateProvider'
    );
  }
  return context;
};
