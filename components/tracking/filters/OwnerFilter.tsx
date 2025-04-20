import React from 'react';
import { Users } from 'lucide-react';
import type { OwnerFilterProps, FilterMode } from '../types/filters';
import OwnershipTypeFilter from '../map/components/OwnershipTypeFilter';

const OwnerFilter: React.FC<OwnerFilterProps> = ({
  activeFilters,
  onFilterChange,
  allOwnerTypes,
  activeDropdown,
  toggleFilterMode,
  dropdownRef,
  toggleDropdown,
}) => {
  return (
    <div ref={dropdownRef} className="relative">
      <button
        className={`px-4 py-2 flex items-center justify-between gap-2 rounded-lg border ${
          activeDropdown === 'owner'
            ? 'bg-indigo-100 text-indigo-700 border-indigo-300 shadow-sm'
            : activeFilters.length < allOwnerTypes.length
              ? 'bg-indigo-50/70 text-indigo-600 border-indigo-200'
              : 'bg-gray-50/30 hover:bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
        } transition-all duration-200`}
        onClick={(event) => toggleDropdown('owner', event)}
      >
        <span className="flex items-center gap-2 font-medium">
          <Users
            size={16}
            className={
              activeFilters.length < allOwnerTypes.length
                ? 'text-indigo-500'
                : 'text-gray-500'
            }
          />
          {activeFilters.length === allOwnerTypes.length
            ? 'Owner Types'
            : `Owner Types (${activeFilters.length})`}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 transition-transform ${activeDropdown === 'owner' ? 'transform rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {activeDropdown === 'owner' && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white shadow-lg rounded-md border border-gray-200 z-50">
          <div className="p-3 border-b flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">
              Owner Type Filters
            </span>
            <div className="space-x-2">
              <button
                onClick={() => onFilterChange([...allOwnerTypes])}
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                Select All
              </button>
              <button
                onClick={() => onFilterChange([])}
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-3">
            <OwnershipTypeFilter
              onFilterChange={onFilterChange}
              activeFilters={activeFilters}
            />
          </div>

          <div className="p-3 border-t flex justify-between items-center">
            <span className="text-xs text-gray-500">
              {activeFilters.length} of {allOwnerTypes.length} selected
            </span>
            <button
              onClick={() => {
                toggleFilterMode('owner');
                toggleDropdown(
                  'owner',
                  new MouseEvent('click') as unknown as React.MouseEvent
                );
              }}
              className="px-3 py-1 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerFilter;
