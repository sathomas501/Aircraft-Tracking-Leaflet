import React from 'react';
import { RegionCode, getRegionName, getAvailableRegions } from '@/types/base';

interface RegionSelectorProps {
  onSelectRegion: (region: RegionCode) => void;
  defaultRegion?: RegionCode;
}

export const RegionSelector: React.FC<RegionSelectorProps> = ({
  onSelectRegion,
  defaultRegion = RegionCode.NORTH_AMERICA,
}) => {
  const regions = getAvailableRegions();

  return (
    <div className="fixed inset-0 bg-gray-100 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Select Region</h2>
        <p className="mb-6 text-gray-600">
          Please select a region to load aircraft tracking data.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {regions.map((region) => (
            <button
              key={region.code}
              className={`py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition ${
                region.code === defaultRegion
                  ? 'ring-2 ring-offset-2 ring-blue-500'
                  : ''
              }`}
              onClick={() => onSelectRegion(region.code)}
            >
              {region.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RegionSelector;
