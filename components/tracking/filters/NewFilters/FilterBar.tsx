// components/tracking/filters/NewFilters/FilterBar.tsx
import React from 'react';
import RegionFilterContainer from '../Containers/RegionFilterContainer';
import ManufacturerFilterContainer from '../Containers/ManufacturerFilterContainer';
import ModelFilterContainer from '../Containers/ModelFilterContainer';
import OwnerFilterContainer from '../Containers/OwnerFilterContainer';
import GeofenceFilterContainer from '../Containers/GeofenceFilterContainer';
import { FilterBarProps } from '../../types/filters';

const FilterBar: React.FC<FilterBarProps> = ({
  modelOptions,
  regionCounts,
  activeRegion,
}) => {
  return (
    <div className="w-full sticky top-0 z-[100] bg-white overflow-visible border-b border-gray-200">
      <div className="flex items-center gap-2 p-2">
        {/* Logo / Title */}
        <div className="bg-indigo-600 text-white flex items-center px-4 py-2 rounded-md font-semibold h-10">
          <span className="mr-2">✈️</span>
          Aircraft Finder
        </div>

        {/* Group filters together */}
        <div className="flex items-center gap-2">
          {/* Use container components instead of direct presentation components */}
          <RegionFilterContainer />
          <ManufacturerFilterContainer />
          <ModelFilterContainer />
          <OwnerFilterContainer />
          <GeofenceFilterContainer />
        </div>

        {/* Spacer */}
        <div className="flex-grow"></div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-md text-sm font-medium hover:bg-indigo-200 transition">
            Refresh
          </button>
          <button className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition">
            Clear Filters
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
