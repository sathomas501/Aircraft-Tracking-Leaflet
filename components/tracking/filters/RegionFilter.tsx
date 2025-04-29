import React from 'react';
import { Globe } from 'lucide-react';
import { RegionCode } from '@/types/base';
import { MAP_CONFIG } from '@/config/map';
import type { RegionFilterProps } from '../types/filters';

const RegionFilter: React.FC<RegionFilterProps> = ({
  activeRegion,
  handleRegionSelect,
  activeDropdown,
  toggleDropdown,
  dropdownRef,
  selectedRegion,
}) => {
  // Helper function to get region name from code
  const getRegionName = (regionCode: RegionCode): string => {
    const entry = Object.entries(MAP_CONFIG.REGIONS).find(
      ([_, code]) => code === regionCode
    );
    return entry ? entry[0] : 'Unknown Region';
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        className={`px-4 py-2 flex items-center justify-between gap-2 rounded-lg border ${
          activeDropdown === 'region'
            ? 'bg-indigo-100 text-indigo-700 border-indigo-300 shadow-sm'
            : activeRegion !== null
              ? 'bg-indigo-50/70 text-indigo-600 border-indigo-200'
              : 'bg-gray-50/30 hover:bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
        } transition-all duration-200`}
        onClick={(event) => toggleDropdown('region', event)}
      >
        <span className="flex items-center gap-2 font-medium">
          <Globe
            size={16}
            className={
              activeRegion !== null ? 'text-indigo-500' : 'text-gray-500'
            }
          />
          {activeRegion !== null && typeof activeRegion !== 'string'
            ? getRegionName(activeRegion)
            : 'Region'}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 transition-transform ${activeDropdown === 'region' ? 'transform rotate-180' : ''}`}
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

      {activeDropdown === 'region' && (
        <div className="absolute left-0 top-full mt-1 w-52 bg-white shadow-lg rounded-md border border-gray-200 z-50">
          <div className="p-3 grid grid-cols-1 gap-2">
            {Object.entries(MAP_CONFIG.REGIONS).map(([name, code]) => (
              <button
                key={name}
                onClick={() => handleRegionSelect(code as RegionCode)}
                className={`px-3 py-2 text-sm rounded-md ${
                  selectedRegion === code
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                    : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RegionFilter;
