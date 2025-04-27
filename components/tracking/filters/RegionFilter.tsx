// components/tracking/filters/RegionFilter.tsx
import React, { RefObject } from 'react';
import { ChevronDown, ChevronUp, Globe } from 'lucide-react';
import { RegionCode } from '../../../types/base'; // adjust path if needed
import { RegionFilterProps } from '../types/filters';
import { MAP_CONFIG } from '../../../config/map'; // adjust path as needed

const RegionFilter: React.FC<RegionFilterProps> = ({
  activeRegion,
  handleRegionSelect,
  activeDropdown,
  toggleDropdown,
  dropdownRef,
  selectedRegion,
  isGeofenceActive,
}) => {
  const isOpen = activeDropdown === 'region';

  // Define available regions based on your map config
  const availableRegions = Object.entries(MAP_CONFIG.REGIONS || {}).map(
    ([name, code]) => ({
      name: name
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (l) => l.toUpperCase()),
      code: code as RegionCode,
    })
  );

  // Helper to get the current region name
  const getRegionName = () => {
    if (!activeRegion) return 'All Regions';
    const region = availableRegions.find(
      (r) => String(r.code) === String(activeRegion)
    );
    return region ? region.name : 'Unknown Region';
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => toggleDropdown('region', e)}
        className={`flex items-center gap-2 h-10 px-3 rounded-md border ${
          activeRegion ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'
        } hover:bg-gray-50 transition ${isGeofenceActive ? 'opacity-50 cursor-not-allowed' : ''}`}
        data-testid="region-filter-button"
        disabled={isGeofenceActive}
      >
        <Globe size={16} className="text-gray-500" />
        <span className="text-sm">{getRegionName()}</span>
        {isOpen ? (
          <ChevronUp size={16} className="text-gray-500" />
        ) : (
          <ChevronDown size={16} className="text-gray-500" />
        )}
      </button>

      {isOpen && !isGeofenceActive && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg w-64 max-h-96 overflow-y-auto z-10">
          <div className="p-2">
            {/* All regions option */}
            <div
              className={`p-2 cursor-pointer rounded hover:bg-gray-100 ${
                activeRegion === null ? 'bg-indigo-50 font-medium' : ''
              }`}
              onClick={() =>
                handleRegionSelect(MAP_CONFIG.REGIONS.GLOBAL as RegionCode)
              }
            >
              All Regions
            </div>

            {/* Available regions */}
            {availableRegions.map(
              (region) =>
                region.code !== MAP_CONFIG.REGIONS.GLOBAL && (
                  <div
                    key={region.code}
                    className={`p-2 cursor-pointer rounded hover:bg-gray-100 ${
                      selectedRegion === region.code ||
                      activeRegion === region.code
                        ? 'bg-indigo-50 font-medium'
                        : ''
                    }`}
                    onClick={() => handleRegionSelect(region.code)}
                  >
                    {region.name}
                  </div>
                )
            )}

            {availableRegions.length === 0 && (
              <div className="p-2 text-gray-500 text-sm">
                No regions available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RegionFilter;
