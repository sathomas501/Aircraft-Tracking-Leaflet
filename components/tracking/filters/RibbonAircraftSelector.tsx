// components/tracking/map/RibbonAircraftSelector.tsx
import React from 'react';

// Define the SelectOption type
export interface SelectOption {
  value: string;
  label: string;
}

interface RibbonAircraftSelectorProps {
  manufacturers: SelectOption[];
}

const RibbonAircraftSelector: React.FC<RibbonAircraftSelectorProps> = ({
  manufacturers,
}) => {
  // Basic implementation - you can enhance this as needed
  return (
    <div className="ribbon-aircraft-selector">
      <h3 className="text-sm font-medium text-gray-700 mb-2">
        Available Manufacturers
      </h3>
      <div className="flex flex-wrap gap-2">
        {manufacturers.map((manufacturer) => (
          <span
            key={manufacturer.value}
            className="px-2 py-1 bg-gray-100 text-xs rounded-md text-gray-800"
          >
            {manufacturer.label}
          </span>
        ))}
        {manufacturers.length === 0 && (
          <span className="text-xs text-gray-500">
            No manufacturers available
          </span>
        )}
      </div>
    </div>
  );
};

export default RibbonAircraftSelector;
