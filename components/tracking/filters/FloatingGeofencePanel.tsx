import React, { useState, useEffect, useRef } from 'react';
import { X, Search, MapPin } from 'lucide-react';
import Draggable from 'react-draggable';
import { MapboxService } from '../../../lib/services/MapboxService';

interface Coordinates {
  lat: number;
  lng: number;
}

interface FormatCityCountryResult {
  city: string;
  country: string;
}

interface FloatingGeofencePanelProps {
  isOpen: boolean;
  onClose: () => void;
  geofenceRadius: number;
  setGeofenceRadius: (radius: number) => void;
  initialPosition?: { x: number; y: number };
  onSearch: (lat: number, lng: number) => void;
  isSearching: boolean;
  coordinates: Coordinates | null;
  setCoordinates: (coords: Coordinates | null) => void;
  isGeofenceActive: boolean;
  isGeofencePlacementMode: boolean;
}

const FloatingGeofencePanel: React.FC<FloatingGeofencePanelProps> = ({
  isOpen,
  onClose,
  geofenceRadius,
  setGeofenceRadius,
  initialPosition,
  onSearch,
  isSearching,
  coordinates,
  setCoordinates,
  isGeofenceActive,
  isGeofencePlacementMode,
}) => {
  const [position, setPosition] = useState(initialPosition);
  const nodeRef = useRef(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Fetch location name whenever coordinates change

  // Add a reference to store the previous coordinates to avoid unnecessary API calls
  const prevCoordinatesRef = useRef<{ lat: number; lng: number } | null>(null);

  // Modify your location name effect to use the ref
  useEffect(() => {
    // Only proceed if we have coordinates
    if (!coordinates) return;

    // Check if these are the same coordinates as before
    const isSameCoordinates =
      prevCoordinatesRef.current?.lat === coordinates.lat &&
      prevCoordinatesRef.current?.lng === coordinates.lng;

    // If these are the same coordinates and we already have a location name or are loading,
    // don't make another API call
    if (isSameCoordinates && (locationName || isLoadingLocation)) {
      return;
    }

    // Near the top of your component
    console.log('onSearch prop:', onSearch);
    console.log('onSearch is function?', typeof onSearch === 'function');

    // Update the reference with current coordinates
    prevCoordinatesRef.current = coordinates;

    // Proceed with API call
    setIsLoadingLocation(true);

    MapboxService.getLocationNameFromCoordinates(
      coordinates.lat,
      coordinates.lng
    )
      .then((name) => {
        setLocationName(name);
      })
      .catch((error) => {
        console.error('Error fetching location name:', error);
      })
      .finally(() => {
        setIsLoadingLocation(false);
      });

    // Don't include locationName in dependencies to avoid loops
  }, [coordinates]);

  // Auto-search when coordinates change, with improved throttling and debouncing

  // Use a reference for the last search coordinates
  const lastSearchRef = useRef<{ lat: number; lng: number } | null>(null);

  // Auto-search when coordinates change
  useEffect(() => {
    let searchTimeout: NodeJS.Timeout | null = null;

    // Only proceed if we have coordinates, aren't searching, and panel is open
    if (!coordinates || isSearching || !isOpen) return;

    // Check if we've already searched these coordinates
    const isSameCoordinates =
      lastSearchRef.current?.lat === coordinates.lat &&
      lastSearchRef.current?.lng === coordinates.lng;

    // Skip if we've already searched these exact coordinates
    if (isSameCoordinates) return;

    // Schedule a search
    searchTimeout = setTimeout(() => {
      // Double-check that conditions are still valid when timeout fires
      if (isOpen && coordinates && !isSearching) {
        // Update reference before search
        lastSearchRef.current = coordinates;
        onSearch(coordinates.lat, coordinates.lng);
      }
    }, 1500);

    // Cleanup function
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [coordinates, isSearching, isOpen, onSearch]);

  useEffect(() => {
    // Only fetch location name if we have coordinates and not in special states
    if (coordinates && !isGeofenceActive && !isGeofencePlacementMode) {
      setIsLoading(true);

      const fetchLocationName = async () => {
        try {
          const name = await MapboxService.getLocationNameFromCoordinates(
            coordinates.lat,
            coordinates.lng
          );
          setLocationName(name);
        } catch (error) {
          console.error('Error fetching location name:', error);
          setLocationName(null);
        } finally {
          setIsLoading(false);
        }
      };

      fetchLocationName();
    }
  }, [coordinates, isGeofenceActive, isGeofencePlacementMode]);

  // Helper function to extract just city and country

  const formatCityCountry = (locationString: string | null): string => {
    if (!locationString) return '';

    // Split by commas
    const parts: string[] = locationString
      .split(',')
      .map((part) => part.trim());

    // If we have city, country (or more parts)
    if (parts.length >= 2) {
      // Try to find the country (usually the last part)
      const country: string = parts[parts.length - 1];

      // For city, use the first meaningful part
      let city: string = parts[0];

      // Skip redundant parts like province/city name duplication (Madrid, Madrid)
      if (parts.length >= 3 && parts[0] === parts[1]) {
        city = parts[0];
      }

      return `${city}, ${country}`;
    }

    return locationString;
  };

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
    console.log('handleSearch function called');
    console.log('coordinates:', coordinates);
    console.log('isSearching:', isSearching);

    if (!coordinates) {
      console.log('No coordinates available');
      return;
    }

    if (isSearching) {
      console.log('Already searching, skipping');
      return;
    }

    console.log(
      'About to call onSearch with:',
      coordinates.lat,
      coordinates.lng
    );
    try {
      onSearch(coordinates.lat, coordinates.lng);
      console.log('onSearch called successfully');
    } catch (error) {
      console.error('Error calling onSearch:', error);
    }
  };

  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".handle"
      defaultPosition={position}
      onStop={(e, data) => setPosition({ x: data.x, y: data.y })}
    >
      <div
        ref={nodeRef}
        className="absolute z-50 bg-white rounded-lg shadow-lg border border-gray-200 w-80 geofence-floating-panel"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        {/* Header/Handle for dragging - with centered title */}
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
          {/* Location display at the top */}
          <div className="mb-4">
            <div className="text-center text-sm font-medium text-gray-700 mb-1">
              Selected Location:
            </div>
            {coordinates && (
              <div className="p-2 bg-gray-50 rounded border border-gray-200 text-center">
                <div className="text-gray-700 font-bold">
                  {isLoadingLocation ? (
                    <span>Loading location name...</span>
                  ) : locationName ? (
                    formatCityCountry(locationName)
                  ) : (
                    `${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}`
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

          {/* Instructions moved down near the button */}
          <div className="mb-3 text-sm text-gray-600 text-center">
            Click anywhere on the map to place a search pin
          </div>

          {/* Search button */}
          {/* Search button */}
          <button
            type="button"
            onClick={handleSearch} // Use your existing handleSearch function
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
