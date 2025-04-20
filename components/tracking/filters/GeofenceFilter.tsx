import React from 'react';
import { MapPin } from 'lucide-react';
import type { GeofenceState } from '../types/filters';

interface GeofenceFilterProps extends GeofenceState {
  activeDropdown: string | null;
  toggleDropdown: (type: string, event: React.MouseEvent) => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
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
  combinedLoading,
  activeDropdown,
  toggleDropdown,
  dropdownRef,
}) => {
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
        disabled={combinedLoading}
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

          <div className="p-3 flex justify-between">
            <button
              className={`flex-1 py-2 rounded-md text-sm ${
                isGeofenceActive
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              onClick={() => toggleGeofenceState(!isGeofenceActive)}
            >
              {isGeofenceActive ? 'Geofence Active' : 'Enable Geofence'}
            </button>

            {isGeofenceActive && (
              <button
                onClick={() => toggleGeofenceState(false)}
                className="ml-2 px-3 py-2 border border-red-200 text-red-600 rounded-md text-sm font-medium hover:bg-red-50"
              >
                Clear
              </button>
            )}
          </div>

          {isGeofenceActive && geofenceCoordinates && (
            <div className="p-3 bg-gray-50 text-xs text-gray-600 border-t">
              <div className="font-medium text-indigo-700 mb-1">
                Geofence Active
              </div>
              <div>
                Coordinates: {geofenceCoordinates.lat.toFixed(4)},{' '}
                {geofenceCoordinates.lng.toFixed(4)}
              </div>
              <div>Radius: {geofenceRadius} km</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GeofenceFilter;
