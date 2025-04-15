// OwnershipTypeFilter.d.ts
// Place this file in the same directory as your OwnershipTypeFilter.jsx

import { FC } from 'react';

export interface OwnershipTypeFilterProps {
  onFilterChange: (selectedTypes: string[]) => void;
  activeFilters: string[];
}

declare const OwnershipTypeFilter: FC<OwnershipTypeFilterProps>;

export default OwnershipTypeFilter;
