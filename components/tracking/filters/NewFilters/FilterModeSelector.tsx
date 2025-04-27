// components/filters/FilterModeSelector.tsx (renamed from StandaloneFilterDropdown)
import React, { useState, useEffect, useRef } from 'react';
import { Filter, MapPin, Users, Layers, Globe } from 'lucide-react';
import { FilterMode } from '../../types/filters';
import { useFilterLogic } from '../../hooks/useFilterLogic';

interface FilterModeSelectorProps {
  className?: string;
}

const FilterModeSelector: React.FC<FilterModeSelectorProps> = ({
  className = '',
}) => {
  const { filterMode, setFilterMode, selectedManufacturer, isGeofenceActive } =
    useFilterLogic();

  // Local state for dropdown visibility
  const [isOpen, setIsOpen] = useState(false);

  // Ref for dropdown to detect outside clicks
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

  // Toggle dropdown visibility
  const toggleDropdown = () => {
    setIsOpen((prev) => !prev);
  };

  // Handle filter selection
  const handleFilterSelect = (mode: FilterMode) => {
    // Update the filter mode in context
    setFilterMode(mode);
    // Close the dropdown
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      {/* Dropdown button */}
      <button
        type="button"
        className={`px-4 py-2 flex items-center justify-between gap-2 rounded-lg border ${
          isOpen
            ? 'bg-indigo-100 text-indigo-700 border-indigo-300 shadow-sm'
            : 'bg-gray-50/30 hover:bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
        } transition-all duration-200`}
        onClick={toggleDropdown}
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
          className={`flex items-center justify-center h-5 w-5 rounded-full ${
            isOpen ? 'bg-indigo-500' : 'bg-gray-200'
          } transition-colors duration-200`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-3 w-3 transition-transform text-white ${
              isOpen ? 'transform rotate-180' : ''
            }`}
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

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1">
            {['manufacturer', 'geofence', 'both', 'owner', 'region'].map(
              (mode) => {
                const typedMode = mode as FilterMode;
                const isDisabled =
                  mode === 'both' &&
                  (!selectedManufacturer || !isGeofenceActive);
                const isSelected = filterMode === mode;

                return (
                  <div
                    key={mode}
                    onClick={() => !isDisabled && handleFilterSelect(typedMode)}
                    className={`px-4 py-2 text-sm ${
                      isSelected
                        ? 'bg-indigo-50 text-indigo-700'
                        : isDisabled
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'text-gray-700 hover:bg-gray-50 cursor-pointer'
                    } flex items-center gap-2`}
                  >
                    {getFilterIcon(typedMode)}
                    <span>{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
                  </div>
                );
              }
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterModeSelector;
