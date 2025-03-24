// components/tracking/map/components/TrailToggle.tsx
import React, { useState } from 'react';
import { useEnhancedMapContext } from '../../context/EnhancedMapContext';

// In TrailToggle.tsx
const TrailToggle: React.FC = () => {
  const { trailsEnabled, toggleTrails, selectedManufacturer } =
    useEnhancedMapContext();
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Don't show anything if no manufacturer is selected
  if (!selectedManufacturer) return null;

  return (
    <>
      <div className="flex items-center justify-between">
        <label
          htmlFor="trail-toggle"
          className="flex items-center cursor-pointer"
        >
          <input
            id="trail-toggle"
            type="checkbox"
            checked={trailsEnabled}
            onChange={toggleTrails}
            className="mr-2 h-4 w-4"
          />
          <span className="text-sm">Show Aircraft Trails</span>
        </label>

        {/* Rest of your UI */}
      </div>
    </>
  );
};

export default TrailToggle;
