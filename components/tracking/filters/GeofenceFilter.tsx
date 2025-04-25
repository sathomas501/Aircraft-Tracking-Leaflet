// components/GeofenceFilter.tsx
import React from 'react';
import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import FloatingGeofencePanel from './FloatingGeofencePanel';
import { useFilterLogic } from '../hooks/useFilterLogic';
import { useGeofencePanel } from '../hooks/useGeofencePanel';
import { useGeolocationServices } from '../hooks/useGeolocationServices';
import { MapboxService } from '../../../lib/services/MapboxService';
import { useLocationFlag } from '../hooks/useLocationFlag';
import { useFormattedCityCountry } from '../hooks/useFormattedCityCountry';
import { getFlagImageUrl } from '../../../utils/getFlagImage';

interface GeofenceFilterProps {
  activeDropdown: string | null;
  setActiveDropdown: (dropdown: string | null) => void;
  toggleDropdown: (type: string, event: React.MouseEvent) => void;
  geofenceLocation: string;
  geofenceRadius: number;
  isGettingLocation: boolean;
  isGeofenceActive: boolean;
  geofenceCoordinates: { lat: number; lng: number } | null;
  combinedLoading: boolean;
  getUserLocation: () => Promise<void>;
  setGeofenceCoordinates: (coordinates: { lat: number; lng: number }) => void;
  setGeofenceCenter: (coordinates: { lat: number; lng: number }) => void;
  updateGeofenceAircraft: (aircraft: any[]) => void;
  setIsGettingLocation: (isGetting: boolean) => void;
  isGeofencePlacementMode: boolean;
  setGeofenceRadius: (radius: number) => void;
  processGeofenceSearch: () => void;
  toggleGeofenceState: (active: boolean) => void;
  setGeofenceLocation: (location: string) => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
}

const GeofenceFilter: React.FC<GeofenceFilterProps> = ({
  activeDropdown,
  setActiveDropdown,
  toggleDropdown,
  dropdownRef,
}) => {
  // Get map context
  const { mapInstance } = useEnhancedMapContext();

  // Get filter logic from the main hook

  const {
    geofenceLocation,
    geofenceRadius,
    isGettingLocation,
    isGeofenceActive,
    geofenceCoordinates,
    combinedLoading,
    setLocationName,
    processGeofenceSearch,
    toggleGeofenceState,
    setGeofenceLocation,
    setGeofenceRadius,
    setGeofenceCoordinates,
    setGeofenceCenter,
    updateGeofenceAircraft,
    setIsGettingLocation,
  } = useFilterLogic();

  // Use the geolocation services hook for browser geolocation
  const geolocationServices = useGeolocationServices();

  // Use the panel hook for managing the floating panel
  const panelLogic = useGeofencePanel({
    geofenceRadius,
    setGeofenceLocation,
    setGeofenceCoordinates,
    processGeofenceSearch,
    setGeofenceCenter,
    updateGeofenceAircraft,
    isGeofenceActive,
    toggleGeofenceState,
    setActiveDropdown,
    mapInstance,
    setCoordinates: () => {}, // Provide a default or actual implementation
    setShowPanel: () => {}, // Provide a default or actual implementation
  });

  const {
    showPanel,
    panelPosition,
    tempCoordinates,
    isSearching,
    locationName,
    isLoadingLocation,
    openPanel,
    closePanel,
    resetPanel,
    setShowPanel,
    handlePanelSearch,
  } = panelLogic;

  // Implement getUserLocation using geolocationServices
  const getUserLocation = async () => {
    if (combinedLoading) return;

    setGeofenceLocation('Getting your location...');
    setIsGettingLocation(true);

    try {
      const position = await geolocationServices.getCurrentPosition();

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      // Update coordinates
      setGeofenceCoordinates({ lat, lng });
      setGeofenceCenter({ lat, lng });

      // Update location text
      setGeofenceLocation(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);

      // Automatically start a search with these coordinates
      handlePanelSearch(lat, lng);
    } catch (error) {
      console.error('Error getting location:', error);
      alert(
        'Could not get your location. Please make sure location services are enabled.'
      );
    } finally {
      setIsGettingLocation(false);
    }
  };

  const [mapboxFeature, setMapboxFeature] = useState<MapboxFeature | null>(
    null
  );

  const [countryName, setCountryName] = useState<string | null>(null);

  // Then modify your useEffect to update this state when location changes
  useEffect(() => {
    // When geofenceLocation or locationName changes, extract the country
    if (isGeofenceActive && geofenceLocation) {
      const country = MapboxService.extractCountry(geofenceLocation);
      setCountryName(country);
    } else if (locationName) {
      const country = MapboxService.extractCountry(locationName);
      setCountryName(country);
    } else {
      setCountryName(null);
    }
  }, [isGeofenceActive, geofenceLocation, locationName]);

  // Update how you use the hook to include the country name
  const { flagUrl, isLoading: isFlagLoading } = useLocationFlag({
    mapboxFeature,
    locationName,
    countryName, // Add this parameter
  });

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

  // When you get location data from Mapbox, store the feature
  interface MapClickEvent {
    lngLat: {
      lng: number;
      lat: number;
    };
  }

  interface MapboxFeature {
    place_name?: string;
  }

  const handleMapClick = async (event: MapClickEvent) => {
    const { lng, lat } = event.lngLat;

    const response = await fetch(
      `/api/proxy/mapbox-geocode?query=${lng},${lat}`
    );
    const data: { features?: MapboxFeature[] } = await response.json();
    const feature = data.features?.[0];

    // Store the feature
    setMapboxFeature(feature || null);

    // Update location name
    if (feature) {
      const name =
        feature.place_name ||
        (await MapboxService.getLocationNameFromCoordinates(lat, lng));
      setLocationName(name);
    }
  };

  useEffect(() => {
    if (isSearching) {
      // Ensure the panel stays open during search
      panelLogic.setShowPanel(true);
    }
  }, [isSearching]);

  const { label, isLoading } = useFormattedCityCountry(geofenceLocation, true);

  return (
    <div ref={dropdownRef} className="relative">
      {/* Ribbon filter button */}
      <button
        className={`px-4 py-2 flex items-center justify-between gap-2 rounded-lg border ${
          showPanel
            ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed' // Always grayed out when panel is open
            : activeDropdown === 'location'
              ? 'bg-indigo-100 text-indigo-700 border-indigo-300 shadow-sm'
              : isGeofenceActive
                ? 'bg-indigo-50/70 text-indigo-600 border-indigo-200'
                : 'bg-gray-50/30 hover:bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
        } transition-all duration-200`}
        // Add a onClick handler that does nothing when panel is open
        onClick={(event) => toggleDropdown('location', event)}
        disabled={combinedLoading}
      >
        <span className="flex items-center gap-2 font-medium">
          <MapPin
            size={16}
            className={
              showPanel
                ? 'text-gray-400' // Gray out icon when panel is open
                : isGeofenceActive
                  ? 'text-indigo-500'
                  : 'text-gray-500'
            }
          />

          {isGeofenceActive && geofenceLocation
            ? renderFlagAndName(label)
            : showPanel
              ? 'Placing pin...'
              : isLoadingLocation
                ? 'Loading location...'
                : locationName
                  ? renderFlagAndName(label)
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

      {/* Dropdown menu */}
      {activeDropdown === 'location' && !showPanel && (
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
                onClick={(e) => {
                  e.preventDefault();
                  openPanel();
                  processGeofenceSearch();
                }}
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

            {/* Map placement button */}
            <button
              onClick={openPanel}
              className="w-full flex items-center justify-center py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              <MapPin size={16} className="mr-2" />
              Click on Map to Set Location
            </button>

            {/* Spacer */}
            <div className="my-2"></div>

            {/* Current location button */}
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

      {/* Floating panel */}
      {showPanel && (
        <FloatingGeofencePanel
          isOpen={showPanel}
          onClose={closePanel}
          geofenceRadius={geofenceRadius}
          setGeofenceRadius={setGeofenceRadius}
          onSearch={handlePanelSearch}
          processGeofenceSearch={processGeofenceSearch}
          isGeofenceActive={isGeofenceActive}
          geofenceLocation={
            geofenceCoordinates || { lat: 0, lng: 0 } // Provide default coordinates if null
          }
          isSearching={isSearching}
          coordinates={tempCoordinates}
          setCoordinates={panelLogic.setTempCoordinates}
          locationName={locationName}
          isLoadingLocation={isLoadingLocation}
          onReset={resetPanel}
          panelPosition={panelPosition ?? null}
          setShowPanel={setShowPanel}
          flagUrl={flagUrl} // Add this prop
        />
      )}
    </div>
  );
};

export default GeofenceFilter;
