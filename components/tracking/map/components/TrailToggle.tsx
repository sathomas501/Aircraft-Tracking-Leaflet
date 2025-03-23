// components/tracking/map/components/TrailToggle.tsx
import React, { useState } from 'react';
import { useEnhancedMapContext } from '../../context/EnhancedMapContext';

const TrailToggle: React.FC = () => {
  const { trailsEnabled, toggleTrails, selectedManufacturer } =
    useEnhancedMapContext();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  console.log('Trail toggle rendering', {
    trailsEnabled,
    selectedManufacturer,
  });

  // Don't show anything if no manufacturer is selected
  if (!selectedManufacturer) return null;

  return (
    <div className="absolute bottom-20 left-4 z-20 bg-white p-2 rounded shadow-md">
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

        {trailsEnabled && (
          <button
            onClick={() => setShowSettingsModal(true)}
            className="ml-2 text-xs text-indigo-600 hover:text-indigo-800"
            title="Trail Settings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>

      {/* You could render the TrailSettingsModal here when showSettingsModal is true */}
      {/* {showSettingsModal && (
        <TrailSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
        />
      )} */}
    </div>
  );
};

export default TrailToggle;
