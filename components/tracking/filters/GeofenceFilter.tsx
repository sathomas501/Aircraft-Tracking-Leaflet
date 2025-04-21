import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import type { GeofenceState } from '../types/filters';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import FloatingGeofencePanel from './FloatingGeofencePanel';
import { getAircraftNearLocation } from '../../../lib/services/geofencing';

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
}) => {
  // Get context and state
  const { isGeofencePlacementMode, setIsGeofencePlacementMode } =
    useEnhancedMapContext();
  const [showFloatingPanel, setShowFloatingPanel] = useState(false);
  const [tempCoordinates, setTempCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [isSearching, setIsSearching] = useState(false);

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
      // Get reverse geocoding for the location name
      const locationName = await getLocationNameFromCoordinates(lat, lng);

      // Update the location name state
      if (locationName) {
        setGeofenceLocation(locationName);
      } else {
        // Fallback to coordinates if no name is found
        setGeofenceLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      }

      // Set coordinates - this is the line causing the error
      // Use the function from props directly
      if (setGeofenceCoordinates) {
        setGeofenceCoordinates({ lat, lng });
      }

      // Update center coordinates
      if (setGeofenceCenter) {
        setGeofenceCenter({ lat, lng });
      }

      // Process the geofence search using the existing function
      await fetchAircraftForClickLocation(lat, lng);

      // Activate geofence if not already active
      if (!isGeofenceActive) {
        toggleGeofenceState(true);
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

  // Get location name from coordinates using reverse geocoding
  const getLocationNameFromCoordinates = async (lat: number, lng: number) => {
    try {
      // Format coordinates to string with 4 decimal places
      const locationName = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

      // In a real implementation, you would use Mapbox or another service for reverse geocoding
      // You could implement a full reverse geocoding service here if needed

      return locationName;
    } catch (error) {
      console.error('Error getting location name:', error);
      return null;
    }
  };

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
        disabled={combinedLoading || showFloatingPanel}
      >
        <span className="flex items-center gap-2 font-medium">
          <MapPin
            size={16}
            className={isGeofenceActive ? 'text-indigo-500' : 'text-gray-500'}
          />
          {isGeofenceActive && geofenceLocation
            ? geofenceLocation.length > 15
              ? geofenceLocation.substring(0, 15) + '...'
              : geofenceLocation
            : showFloatingPanel
              ? 'Placing geofence...'
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
        />
      )}
    </div>
  );
};

export default GeofenceFilter;
