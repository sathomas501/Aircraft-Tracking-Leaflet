import React from 'react';
import { Filter, MapPin, Users, Layers, Globe } from 'lucide-react';
import type { FilterMode } from '../types/filters';

interface FilterDropdownProps {
  toggleFilterMode: (mode: FilterMode) => void;
  selectedManufacturer: string | null;
  isGeofenceActive: boolean;
  filterMode: FilterMode | null;
  activeDropdown: string | null;
  toggleDropdown: (type: string, event: React.MouseEvent) => void;
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({
  toggleFilterMode,
  selectedManufacturer,
  isGeofenceActive,
  filterMode,
  activeDropdown,
  toggleDropdown,
}) => {
  // Helper function to get icon based on filter mode
  const getFilterIcon = (mode: FilterMode | null) => {
    switch (mode) {
      case 'manufacturer':
        return <Filter size={16} />;
      case 'geofence':
        return <MapPin size={16} />;
      case 'both':
        return <Layers size={16} />;
      case 'owner':
        return <Users size={16} />;
      case 'region':
        return <Globe size={16} />;
      default:
        return <Filter size={16} />;
    }
  };

  return (
    <div className="relative">
      <button
        className={`px-4 py-2 flex items-center justify-between gap-2 rounded-lg border ${
          activeDropdown === 'filter'
            ? 'bg-indigo-100 text-indigo-700 border-indigo-300 shadow-sm'
            : 'bg-gray-50/30 hover:bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
        } transition-all duration-200`}
        onClick={(event) => toggleDropdown('filter', event)}
      >
        <span className="flex items-center gap-2 font-medium">
          {getFilterIcon(filterMode)}
          <span className={filterMode ? 'text-indigo-700' : ''}>
            {filterMode
              ? filterMode.charAt(0).toUpperCase() + filterMode.slice(1)
              : 'Filter Selection'}
          </span>
        </span>
        <div
          className={`flex items-center justify-center h-5 w-5 rounded-full ${activeDropdown === 'filter' ? 'bg-indigo-500' : 'bg-gray-200'} transition-colors duration-200`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-3 w-3 transition-transform text-white ${activeDropdown === 'filter' ? 'transform rotate-180' : ''}`}
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
        </div>
      </button>

      {activeDropdown === 'filter' && (
        <div className="absolute left-0 top-full mt-1 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
          <div className="py-1">
            {['manufacturer', 'geofence', 'both', 'owner', 'region'].map(
              (mode) => (
                <button
                  key={mode}
                  className={`w-full text-left px-4 py-2 text-sm ${filterMode === mode ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'} flex items-center gap-2`}
                  onClick={() => toggleFilterMode(mode as FilterMode)}
                  disabled={
                    mode === 'both' &&
                    (!selectedManufacturer || !isGeofenceActive)
                  }
                >
                  {getFilterIcon(mode as FilterMode)}
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterDropdown;
