// components/tracking/map/components/TrailToggle.tsx
import React, { useState } from 'react';
import { useEnhancedMapContext } from '../../context/EnhancedMapContext';
import TrailSettingsModal from './TrailSettingModal';
import openSkyTrackingService from '@/lib/services/openSkyTrackingService';

const TrailToggle: React.FC = () => {
  const {
    trailsEnabled,
    toggleTrails,
    selectedManufacturer,
    maxTrailLength,
    aircraftTrails,
  } = useEnhancedMapContext();

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isGeneratingTrails, setIsGeneratingTrails] = useState(false);

  // Don't show anything if no manufacturer is selected
  if (!selectedManufacturer) return null;

  const trailCount = aircraftTrails?.size || 0;

  // Force trail generation function
  const handleForceTrails = () => {
    console.log('Forcing trail generation...');
    setIsGeneratingTrails(true);

    try {
      // Use the force trail generation function from the service
      openSkyTrackingService.forceGenerateTrails();

      // Set a timeout to reset the button state
      setTimeout(() => {
        setIsGeneratingTrails(false);
      }, 1500);
    } catch (error) {
      console.error('Error generating trails:', error);
      setIsGeneratingTrails(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between bg-white rounded-lg shadow-md p-2 mb-2">
        <label
          htmlFor="trail-toggle"
          className="flex items-center cursor-pointer"
        >
          <input
            id="trail-toggle"
            type="checkbox"
            checked={trailsEnabled}
            onChange={() => {
              console.log(
                'Trail toggle clicked, current state:',
                trailsEnabled
              );
              toggleTrails();
            }}
            className="mr-2 h-4 w-4"
          />
          <span className="text-sm">Show Aircraft Trails</span>

          {trailsEnabled && (
            <span className="ml-2 text-xs text-gray-500">
              ({trailCount} trails, max {maxTrailLength} points)
            </span>
          )}
        </label>

        <div className="flex items-center">
          {/* Force Trails button - visible even when trails are off */}
          <button
            onClick={handleForceTrails}
            disabled={isGeneratingTrails}
            className={`text-xs px-2 py-1 rounded mr-2 ${
              isGeneratingTrails
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                : 'bg-orange-500 text-white hover:bg-orange-600'
            }`}
            title="Force Generate Trails"
          >
            {isGeneratingTrails ? 'Generating...' : 'Force Trails'}
          </button>

          {trailsEnabled && (
            <button
              onClick={() => setShowSettingsModal(true)}
              className="text-gray-600 hover:text-blue-600"
              title="Trail Settings"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
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
      </div>

      {/* Trail Settings Modal */}
      <TrailSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </>
  );
};

export default TrailToggle;
