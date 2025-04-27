// components/tracking/filters/GeofenceFilter.tsx
import React, { RefObject } from 'react';
import { ChevronDown, ChevronUp, MapPin, LocateFixed } from 'lucide-react';
import { GeofenceFilterProps } from '../types/filters';

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
  combinedLoading,
  activeDropdown,
  setActiveDropdown,
  toggleDropdown,
  dropdownRef,
  isGeofencePlacementMode,
  setIsGettingLocation,
}) => {
  const isOpen = activeDropdown === 'location';

  // Handle radius change
  const handleRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setGeofenceRadius(value);
    }
  };

  // Handle location input change
  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGeofenceLocation(e.target.value);

    // Clear coordinates if input is modified
    if (geofenceCoordinates) {
      setGeofenceCoordinates(null);
    }
  };

  const handleToggleGeofenceState = () => {
    toggleGeofenceState(!isGeofenceActive);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => toggleDropdown('location', e)}
        className={`flex items-center gap-2 h-10 px-3 rounded-md border ${
          isGeofenceActive
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-gray-300'
        } hover:bg-gray-50 transition`}
        data-testid="geofence-filter-button"
      >
        <MapPin size={16} className="text-gray-500" />
        <span className="text-sm">
          {isGeofenceActive ? `Location (${geofenceRadius}km)` : 'Location'}
        </span>
        {isOpen ? (
          <ChevronUp size={16} className="text-gray-500" />
        ) : (
          <ChevronDown size={16} className="text-gray-500" />
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg w-72 z-10">
          <div className="p-3">
            {/* Location input with current location button */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location (lat, lng or address)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-grow">
                  <input
                    type="text"
                    value={geofenceLocation}
                    onChange={handleLocationChange}
                    placeholder="Enter coordinates or address"
                    className="w-full p-2 border border-gray-300 rounded-md"
                    disabled={isGettingLocation}
                  />
                  {isGettingLocation && (
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => getUserLocation()}
                  className="p-2 bg-gray-100 rounded-md hover:bg-gray-200 transition"
                  disabled={isGettingLocation}
                  title="Use current location"
                >
                  <LocateFixed size={18} className="text-gray-700" />
                </button>
              </div>
            </div>

            {/* Radius slider */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Radius: {geofenceRadius} km
              </label>
              <input
                type="range"
                min="1"
                max="200"
                value={geofenceRadius}
                onChange={handleRadiusChange}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>1km</span>
                <span>100km</span>
                <span>200km</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={processGeofenceSearch}
                disabled={!geofenceLocation || combinedLoading}
                className={`flex-grow py-2 rounded-md text-sm font-medium ${
                  !geofenceLocation || combinedLoading
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : isGeofenceActive
                      ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                } transition`}
              >
                {isGeofenceActive ? 'Update Search' : 'Search Area'}
              </button>

              {isGeofenceActive && (
                <button
                  onClick={handleToggleGeofenceState}
                  className="py-2 px-3 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium transition"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeofenceFilter;
