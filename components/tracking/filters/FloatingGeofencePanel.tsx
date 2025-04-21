import React, { useState, useEffect, useRef } from 'react';
import { X, Search, MapPin } from 'lucide-react';
// Note: You'll need to install this package with:
// npm install react-draggable
import Draggable from 'react-draggable';

interface FloatingGeofencePanelProps {
  isOpen: boolean;
  onClose: () => void;
  geofenceRadius: number;
  setGeofenceRadius: (radius: number) => void;
  initialPosition?: { x: number; y: number };
  onSearch: (lat: number, lng: number) => void;
  isSearching: boolean;
  coordinates: { lat: number; lng: number } | null;
  setCoordinates: (coords: { lat: number; lng: number } | null) => void;
}

const FloatingGeofencePanel: React.FC<FloatingGeofencePanelProps> = ({
  isOpen,
  onClose,
  geofenceRadius,
  setGeofenceRadius,
  initialPosition = { x: 100, y: 100 },
  onSearch,
  isSearching,
  coordinates,
  setCoordinates,
}) => {
  const [position, setPosition] = useState(initialPosition);
  const nodeRef = useRef(null);

  // Auto-search when coordinates change, with improved throttling and debouncing
  useEffect(() => {
    let searchTimeout: NodeJS.Timeout | null = null;

    if (coordinates && !isSearching) {
      // Add a single search that won't repeat
      searchTimeout = setTimeout(() => {
        // Only trigger once and only if panel is still open and coordinates haven't changed
        if (isOpen && coordinates && !isSearching) {
          // Set a flag to prevent multiple API calls
          onSearch(coordinates.lat, coordinates.lng);
        }
      }, 1500); // Increased to 1.5 seconds to reduce API call frequency
    }

    // Cleanup function to prevent memory leaks and cancel pending searches
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [coordinates?.lat, coordinates?.lng]); // Only re-run when coordinates actually change

  // Enable map click mode when panel is opened
  useEffect(() => {
    if (isOpen) {
      // Dispatch event to notify map that we're in geofence placement mode
      const event = new CustomEvent('enable-geofence-placement', {
        detail: { active: true },
      });
      document.dispatchEvent(event);

      // Set up listener for map click events
      const handleMapClick = (e: CustomEvent) => {
        const { lat, lng } = e.detail;
        setCoordinates({ lat, lng });
      };

      document.addEventListener(
        'map-geofence-click',
        handleMapClick as EventListener
      );

      return () => {
        // Clean up
        document.removeEventListener(
          'map-geofence-click',
          handleMapClick as EventListener
        );
        // Turn off placement mode when component unmounts
        const event = new CustomEvent('enable-geofence-placement', {
          detail: { active: false },
        });
        document.dispatchEvent(event);
      };
    }
  }, [isOpen, setCoordinates]);

  // Handle search button click
  const handleSearch = () => {
    if (coordinates) {
      onSearch(coordinates.lat, coordinates.lng);
    }
  };

  if (!isOpen) return null;

  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".handle"
      defaultPosition={position}
      onStop={(e, data) => setPosition({ x: data.x, y: data.y })}
    >
      <div
        ref={nodeRef}
        className="absolute z-50 bg-white rounded-lg shadow-lg border border-gray-200 w-80"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        {/* Header/Handle for dragging */}
        <div className="handle px-4 py-3 bg-indigo-600 text-white rounded-t-lg flex items-center justify-between cursor-move">
          <div className="flex items-center">
            <MapPin size={16} className="mr-2" />
            <span className="font-medium">Geofence Placement</span>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-indigo-700 rounded-full p-1"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          {/* Instructions */}
          <div className="mb-4 text-sm text-gray-600">
            Click anywhere on the map to place the geofence center
          </div>

          {/* Coordinates display */}
          {coordinates && (
            <div className="mb-4 p-2 bg-gray-50 rounded border border-gray-200 text-sm">
              <div className="font-medium text-gray-700 mb-1">
                Selected Location:
              </div>
              <div className="text-gray-600">
                {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
              </div>
            </div>
          )}

          {/* Radius slider */}
          <div className="mb-4">
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

          {/* Search button */}
          <button
            onClick={handleSearch}
            disabled={!coordinates || isSearching}
            className={`w-full py-2 px-4 flex items-center justify-center gap-2 rounded-md ${
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
        </div>
      </div>
    </Draggable>
  );
};

export default FloatingGeofencePanel;
