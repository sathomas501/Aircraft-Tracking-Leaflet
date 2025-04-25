// FloatingGeofencePanel.tsx - Simplified to be purely presentational
import React, { useState, useRef, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import Draggable from 'react-draggable';
import { MapboxService } from '../../../lib/services/MapboxService';
import { getFlagImageUrl } from '../../../utils/getFlagImage';
import { useFormattedCityCountry } from '../hooks/useFormattedCityCountry';

interface Coordinates {
  lat: number;
  lng: number;
}

interface FloatingGeofencePanelProps {
  isOpen: boolean;
  onClose: () => void;
  geofenceRadius: number;
  setGeofenceRadius: (radius: number) => void;
  onSearch: (lat: number, lng: number) => void;
  panelPosition: null | { x: number; y: number };
  isGeofenceActive: boolean;
  geofenceLocation: Coordinates | null;

  setShowPanel: (show: boolean) => void;
  isSearching: boolean;
  coordinates: Coordinates | null;
  setCoordinates: (coords: Coordinates | null) => void;
  locationName: string | null;
  isLoadingLocation: boolean;
  processGeofenceSearch: (fromPanel?: boolean) => void;
  onReset: () => void;
  flagUrl?: string | null; // Optional flag URL prop
}

const FloatingGeofencePanel: React.FC<FloatingGeofencePanelProps> = ({
  isOpen,
  onClose,
  geofenceRadius,
  setGeofenceRadius,
  processGeofenceSearch,
  isGeofenceActive,
  geofenceLocation,
  isSearching,
  coordinates,
  setCoordinates,
  locationName,
  isLoadingLocation,
  panelPosition,
  setShowPanel,
  onSearch,
  onReset, // Destructure the onReset prop
  flagUrl, // Optional flag URL prop
}) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [countryName, setCountryName] = useState<string | null>(null);
  const nodeRef = useRef(null);
  const { label, isLoading } = useFormattedCityCountry(geofenceLocation, true);

  // The reset button directly calls the onReset prop
  // This function is passed from the parent component
  // and handles clearing coordinates, location data, etc.
  const handleReset = () => {
    if (onReset) {
      onReset(); // Call the provided onReset function
    }
  };

  // Helper function to render flag with location name
  function renderFlagAndName(label: string | null) {
    if (!label) return null;

    const country = label.split(', ').pop() || '';
    const flagUrl = getFlagImageUrl(country);

    return (
      <div className="inline-flex items-center gap-2">
        {flagUrl && (
          <img
            src={flagUrl}
            alt={`${country} flag`}
            className="w-4 h-3 object-cover rounded-sm shadow-sm"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        )}
        <span>{label}</span>
      </div>
    );
  }

  // Then modify your useEffect to update this state when location changes
  useEffect(() => {
    // When geofenceLocation or locationName changes, extract the country
    if (isGeofenceActive && geofenceLocation) {
      const locationString = `${geofenceLocation.lat}, ${geofenceLocation.lng}`;
      const country = MapboxService.extractCountry(locationString);
      setCountryName(country);
    } else if (locationName) {
      const country = MapboxService.extractCountry(locationName);
      setCountryName(country);
    } else {
      setCountryName(null);
    }
  }, [isGeofenceActive, geofenceLocation, locationName]);

  return (
    <Draggable nodeRef={nodeRef} handle=".handle">
      <div
        ref={nodeRef}
        className="absolute z-50 bg-white rounded-lg shadow-lg border border-gray-200 w-80 geofence-floating-panel"
        style={{ top: 0, left: 0 }}
      >
        {/* Header/Handle for dragging */}
        <div className="handle px-4 py-3 bg-indigo-600 text-white rounded-t-lg flex items-center justify-between cursor-move">
          <button
            onClick={onClose}
            className="text-white hover:bg-indigo-700 rounded-full p-1"
            title="Close"
          >
            <X size={16} />
          </button>
          <div className="flex items-center justify-center flex-grow mx-auto">
            <span className="font-medium text-center">
              Search Pin Placement
            </span>
          </div>
          <div className="w-4"></div> {/* Empty div for balancing the layout */}
        </div>

        {/* Body */}
        <div className="p-4">
          {/* Location display */}
          <div className="mb-4">
            <div className="text-center text-sm font-medium text-gray-700 mb-1">
              Selected Location:
            </div>
            {coordinates && (
              <div className="p-2 bg-gray-50 rounded border border-gray-200 text-center">
                <div className="text-gray-700 font-bold flex items-center justify-center gap-2">
                  {isLoadingLocation ? (
                    <span>Loading location name...</span>
                  ) : (
                    renderFlagAndName(label)
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
                </div>
              </div>
            )}
          </div>

          {/* Radius slider */}
          <div className="mb-6">
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Radius: {geofenceRadius} km
            </label>
            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={geofenceRadius}
              onChange={(e) => setGeofenceRadius(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>5 km</span>
              <span>50 km</span>
              <span>100 km</span>
            </div>
          </div>

          {/* Instructions */}
          <div className="mb-3 text-sm text-gray-600 text-center">
            Click anywhere on the map to place a search pin
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 w-full">
            {/* Search Button */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                processGeofenceSearch(true); // Pass true to indicate search is from panel
              }}
              disabled={!coordinates || isSearching}
              className={`flex-1 py-2 px-4 flex items-center justify-center gap-2 rounded-md ${
                !coordinates || isSearching
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              } transition-colors`}
            >
              {isSearching ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Searching...
                </>
              ) : (
                <>
                  <Search size={16} />
                  Search Aircraft
                </>
              )}
            </button>

            {/* Reset Button */}
            <button
              type="button"
              onClick={handleReset} // ✅ Now uses your custom handler
              className="flex-1 py-2 px-4 flex items-center justify-center gap-2 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </Draggable>
  );
};

export default FloatingGeofencePanel;
