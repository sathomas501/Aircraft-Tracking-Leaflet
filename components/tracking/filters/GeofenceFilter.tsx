// Description: This component handles the geofence filter functionality, including location search, radius adjustment, and aircraft data fetching.
// It also manages the floating panel for geofence placement on the map.
import React, { useState, useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';
import type { GeofenceState } from '../types/filters';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import FloatingGeofencePanel from './FloatingGeofencePanel';
import { getAircraftNearLocation } from '../../../lib/services/geofencing';
import { MapboxService } from '../../../lib/services/MapboxService';
import { getFlagImageUrl } from '../../../utils/getFlagImage';

interface GeofenceFilterProps extends GeofenceState {
  activeDropdown: string | null;
  setActiveDropdown: (dropdown: string | null) => void;
  toggleDropdown: (type: string, event: React.MouseEvent) => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
  setGeofenceCoordinates: (
    coordinates: { lat: number; lng: number } | null
  ) => void;
  setGeofenceCenter: (coordinates: { lat: number; lng: number }) => void;
  updateGeofenceAircraft: (aircraft: any[]) => void;
  isGeofenceActive: boolean;
  geofenceLocation: string;
  isGeofencePlacementMode: boolean;
  coordinates?: { lat: number; lng: number };
}

const GeofenceFilter: React.FC<GeofenceFilterProps> = ({
  geofenceLocation,
  geofenceRadius,
  isGettingLocation,
  isGeofenceActive,
  geofenceCoordinates,
  getUserLocation,
  processGeofenceSearch,
  toggleGeofenceState,
  setGeofenceLocation,
  setGeofenceRadius,
  setGeofenceCoordinates,
  setGeofenceCenter,
  setActiveDropdown,
  combinedLoading,
  activeDropdown,
  toggleDropdown,
  dropdownRef,
  updateGeofenceAircraft,
  coordinates,
}) => {
  // Get context and state
  const { isGeofencePlacementMode, setIsGeofencePlacementMode, mapInstance } =
    useEnhancedMapContext();
  const [showFloatingPanel, setShowFloatingPanel] = useState(false);
  const [tempCoordinates, setTempCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const prevCoordinatesRef = useRef<{ lat: number; lng: number } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  // Handle opening the floating panel
  const openFloatingPanel = () => {
    setShowFloatingPanel(true);
    setIsGeofencePlacementMode(true); // Enter placement mode
    setActiveDropdown(null); // Close the dropdown
  };

  // Handle closing the floating panel
  const closeFloatingPanel = () => {
    setShowFloatingPanel(false);
    setIsGeofencePlacementMode(false);
    setTempCoordinates(null); // Clear temporary coordinates
  };

  // Handle panel search
  const handlePanelSearch = async (lat: number, lng: number) => {
    setIsSearching(true);
    try {
      // Update the geofence location name
      const locationName = await MapboxService.getLocationNameFromCoordinates(
        lat,
        lng
      );

      // Set the location name
      if (locationName) {
        setGeofenceLocation(locationName);
      } else {
        // Fallback to coordinates if no name is found
        setGeofenceLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      }

      // Set coordinates using the same functions from processGeofenceSearch
      if (setGeofenceCoordinates) {
        setGeofenceCoordinates({ lat, lng });
      }

      if (setGeofenceCenter) {
        setGeofenceCenter({ lat, lng });
      }

      // Get aircraft data near this location
      await fetchAircraftForClickLocation(lat, lng);

      // Activate geofence if not already active
      if (!isGeofenceActive) {
        toggleGeofenceState(true);
      }

      // Center the map on this location
      if (mapInstance && typeof mapInstance.setView === 'function') {
        // Get current zoom level
        const currentZoom = mapInstance.getZoom();
        // Use appropriate zoom level based on current view
        const targetZoom = currentZoom <= 7 ? 9 : currentZoom;

        // Set view to the coordinates
        mapInstance.setView([lat, lng], targetZoom);

        // Ensure map is updated
        mapInstance.invalidateSize();
      }
    } catch (error) {
      console.error('Error searching from panel:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Function to get and process aircraft data
  const fetchAircraftForClickLocation = async (lat: number, lng: number) => {
    try {
      console.log('Fetching aircraft near clicked location:', lat, lng);

      // Call the existing function from your geofencing.ts
      const fetchedAircraft = await getAircraftNearLocation(
        lat,
        lng,
        geofenceRadius || 25
      );

      // Process the aircraft data
      if (fetchedAircraft.length === 0) {
        console.log('No aircraft found near clicked location');
        return;
      }

      // Update the context with the new aircraft - add null check
      if (typeof updateGeofenceAircraft === 'function') {
        updateGeofenceAircraft(fetchedAircraft);
      } else {
        console.warn(
          'updateGeofenceAircraft is not available or not a function'
        );
      }

      console.log(
        `Found ${fetchedAircraft.length} aircraft near clicked location`
      );
    } catch (error) {
      console.error('Error fetching aircraft for clicked location:', error);
    }
  };

  // Enhanced function to extract just city and country or just country
  interface FormatCityCountryOptions {
    locationString: string;
    countryOnly?: boolean;
  }

  const formatCityCountry = (
    locationString: FormatCityCountryOptions['locationString'],
    countryOnly: FormatCityCountryOptions['countryOnly'] = false
  ): string => {
    if (!locationString) return '';

    // Split by commas
    const parts = locationString.split(',').map((part) => part.trim());

    // If we only want the country
    if (countryOnly && parts.length >= 1) {
      // Return the last part (usually the country)
      return parts[parts.length - 1];
    }

    // For city, country format
    if (parts.length >= 2) {
      // Get country (usually the last part)
      const country = parts[parts.length - 1];

      // For city, use the first meaningful part
      let city = parts[0];

      // Skip redundant parts like province/city name duplication (Madrid, Madrid)
      if (parts.length >= 3 && parts[0] === parts[1]) {
        city = parts[0];
      }

      return `${city}, ${country}`;
    }

    return locationString;
  };

  const country = formatCityCountry(locationName || '', true);
  const flagUrl = getFlagImageUrl(country);

  const renderFlagAndName = (countryName: string) => {
    const flagUrl = getFlagImageUrl(countryName);
    return (
      <span className="flex items-center gap-2">
        {flagUrl && (
          <img
            src={flagUrl}
            alt={`${countryName} flag`}
            className="w-5 h-3 rounded-sm"
          />
        )}
        {countryName}
      </span>
    );
  };

  useEffect(() => {
    if (coordinates && !isGeofenceActive && !isGeofencePlacementMode) {
      const fetchLocationName = async () => {
        try {
          // Make sure to pass both lat and lng as separate arguments
          // or according to how your function is defined
          const name = await MapboxService.getLocationNameFromCoordinates(
            coordinates.lat,
            coordinates.lng
          );
          setLocationName(name);
        } catch (error) {
          console.error('Error fetching location name:', error);
          setLocationName(null);
        }
      };

      fetchLocationName();
    }
  }, [coordinates, isGeofenceActive, isGeofencePlacementMode]);

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

  // In your location name effect
  useEffect(() => {
    if (!coordinates) return;

    const isSameCoordinates =
      prevCoordinatesRef.current?.lat === coordinates.lat &&
      prevCoordinatesRef.current?.lng === coordinates.lng;

    if (isSameCoordinates && (locationName || isLoadingLocation)) {
      return;
    }

    prevCoordinatesRef.current = coordinates;

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
  }, [coordinates]);

  // Listen for the clear all filters event
  useEffect(() => {
    const handleClearAllFilters = () => {
      // Close the floating panel when filters are cleared
      if (showFloatingPanel) {
        closeFloatingPanel();
      }
    };

    // Add event listener for the clear all filters event
    document.addEventListener('ribbon-filters-cleared', handleClearAllFilters);

    // Clean up
    return () => {
      document.removeEventListener(
        'ribbon-filters-cleared',
        handleClearAllFilters
      );
    };
  }, [showFloatingPanel, closeFloatingPanel]);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        className={`px-4 py-2 flex items-center justify-between gap-2 rounded-lg border ${
          activeDropdown === 'location'
            ? 'bg-indigo-100 text-indigo-700 border-indigo-300 shadow-sm'
            : isGeofenceActive
              ? 'bg-indigo-50/70 text-indigo-600 border-indigo-200'
              : 'bg-gray-50/30 hover:bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
        } transition-all duration-200`}
        onClick={(event) => toggleDropdown('location', event)}
        disabled={combinedLoading || isGeofencePlacementMode}
      >
        <span className="flex items-center gap-2 font-medium">
          <MapPin
            size={16}
            className={isGeofenceActive ? 'text-indigo-500' : 'text-gray-500'}
          />
          {isGeofenceActive && geofenceLocation
            ? renderFlagAndName(formatCityCountry(geofenceLocation, true))
            : isGeofencePlacementMode
              ? 'Click on map...'
              : isLoading
                ? 'Loading location...'
                : locationName
                  ? renderFlagAndName(formatCityCountry(locationName, true))
                  : 'Location'}
        </span>

        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 transition-transform ${activeDropdown === 'location' ? 'transform rotate-180' : ''}`}
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

      {activeDropdown === 'location' && (
        <div className="absolute left-0 top-full mt-1 w-72 bg-white shadow-lg rounded-md border border-gray-200 z-50">
          {/* Location search input */}
          <div className="p-3 border-b">
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                placeholder="ZIP code or coordinates..."
                value={geofenceLocation}
                onChange={(e) => setGeofenceLocation(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    !combinedLoading &&
                    geofenceLocation
                  ) {
                    processGeofenceSearch();
                  }
                }}
                autoFocus
              />
              <button
                className={`px-3 py-2 rounded-md text-white ${
                  combinedLoading || (!geofenceLocation && !isGettingLocation)
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
                onClick={processGeofenceSearch}
                disabled={
                  combinedLoading || (!geofenceLocation && !isGettingLocation)
                }
                title="Search"
              >
                {combinedLoading ? (
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
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                )}
              </button>
            </div>

            {/* Replace the placement mode button with one that opens the floating panel */}
            <button
              onClick={openFloatingPanel}
              className="w-full flex items-center justify-center py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              <MapPin size={16} className="mr-2" />
              Click on Map to Set Location
            </button>

            {/* Spacer */}
            <div className="my-2"></div>

            {/* Current location button - keep existing button */}
            <button
              className={`w-full flex items-center justify-center py-2 border border-indigo-300 rounded-md text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors ${
                isGettingLocation ? 'opacity-75 cursor-not-allowed' : ''
              }`}
              onClick={getUserLocation}
              disabled={isGettingLocation || combinedLoading}
            >
              {isGettingLocation ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 mr-2"
                    viewBox="0 0 24 24"
                  >
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
                  Getting location...
                </>
              ) : (
                <>
                  <MapPin size={16} className="mr-2" />
                  Use My Current Location
                </>
              )}
            </button>
          </div>

          {/* Radius slider */}
          <div className="p-3 border-b">
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
        </div>
      )}

      {/* Render the floating panel when active */}
      {showFloatingPanel && (
        <FloatingGeofencePanel
          isOpen={showFloatingPanel}
          onClose={closeFloatingPanel}
          geofenceRadius={geofenceRadius}
          setGeofenceRadius={setGeofenceRadius}
          onSearch={handlePanelSearch}
          isSearching={isSearching}
          coordinates={tempCoordinates}
          setCoordinates={setTempCoordinates}
          isGeofenceActive={isGeofenceActive}
          isGeofencePlacementMode={isGeofencePlacementMode}
        />
      )}
    </div>
  );
};

export default GeofenceFilter;
