// components/tracking/GeofenceTracker.tsx
import React, { useState, useEffect, useCallback } from 'react';
import type { ExtendedAircraft } from '../../types/base';
import {
  fetchAircraftInGeofence,
  createGeofenceFromZipCode,
  getAircraftNearLocation,
} from '../../lib/services/geofencing';

interface GeofenceTrackerProps {
  onAircraftFound: (
    aircraft: ExtendedAircraft[],
    locationInfo?: {
      label: string;
      coordinates?: { lat: number; lng: number };
      radius: number;
    }
  ) => void;
  autoRefresh?: boolean;
  refreshInterval?: number;
  initialZipCode?: string;
  initialRadius?: number;
}

const GeofenceTracker: React.FC<GeofenceTrackerProps> = ({
  onAircraftFound,
  autoRefresh = true,
  refreshInterval = 60000, // 1 minute
  initialZipCode = '',
  initialRadius = 25,
}) => {
  const [searchMode, setSearchMode] = useState<'zip' | 'location'>('zip');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // ZIP code search state
  const [zipCode, setZipCode] = useState<string>(initialZipCode);

  // Location search state
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');

  // Shared search state
  const [searchRadius, setSearchRadius] = useState<number>(initialRadius);
  const [aircraftCount, setAircraftCount] = useState<number>(0);
  const [useCurrentLocation, setUseCurrentLocation] = useState<boolean>(false);

  // Location fetching status
  const [isFetchingLocation, setIsFetchingLocation] = useState<boolean>(false);

  // Function to load aircraft data by ZIP code
  const loadAircraftByZip = useCallback(async () => {
    if (!zipCode || zipCode.length < 5) {
      setError('Please enter a valid 5-digit ZIP code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // First get coordinates from ZIP code
      const geofence = await createGeofenceFromZipCode(zipCode, searchRadius);

      if (!geofence) {
        throw new Error(`Could not get coordinates for ZIP code ${zipCode}`);
      }

      // Then fetch aircraft within geofence
      const aircraft = await fetchAircraftInGeofence(geofence);

      // Process results
      setAircraftCount(aircraft.length);
      setLastRefresh(new Date());

      // Prepare location info to pass back
      const locationInfo = {
        label: `ZIP code ${zipCode}`,
        radius: searchRadius,
        // Get the center of the geofence as coordinates
        coordinates: {
          lat: (geofence.lamin + geofence.lamax) / 2,
          lng: (geofence.lomin + geofence.lomax) / 2,
        },
      };

      // Notify parent component
      onAircraftFound(aircraft, locationInfo);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error fetching aircraft data'
      );
      console.error('Error loading aircraft by ZIP:', err);
    } finally {
      setIsLoading(false);
    }
  }, [zipCode, searchRadius, onAircraftFound]);

  // Function to load aircraft data by coordinates
  const loadAircraftByCoordinates = useCallback(async () => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      setError('Please enter valid latitude and longitude values');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch aircraft near location
      const aircraft = await getAircraftNearLocation(lat, lng, searchRadius);

      // Process results
      setAircraftCount(aircraft.length);
      setLastRefresh(new Date());

      // Prepare location info to pass back
      const locationInfo = {
        label: `Coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        radius: searchRadius,
        coordinates: { lat, lng },
      };

      // Notify parent component
      onAircraftFound(aircraft, locationInfo);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error fetching aircraft data'
      );
      console.error('Error loading aircraft by coordinates:', err);
    } finally {
      setIsLoading(false);
    }
  }, [latitude, longitude, searchRadius, onAircraftFound]);

  // Get current location
  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setIsFetchingLocation(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toString());
        setLongitude(position.coords.longitude.toString());
        setSearchMode('location');
        setIsFetchingLocation(false);

        // Automatically search after getting location
        setTimeout(() => {
          loadAircraftByCoordinates();
        }, 500);
      },
      (error) => {
        setError(`Error getting location: ${error.message}`);
        setIsFetchingLocation(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, [loadAircraftByCoordinates]);

  // Search handler based on current mode
  const handleSearch = useCallback(() => {
    if (searchMode === 'zip') {
      loadAircraftByZip();
    } else {
      loadAircraftByCoordinates();
    }
  }, [searchMode, loadAircraftByZip, loadAircraftByCoordinates]);

  // Set up auto-refresh if enabled
  useEffect(() => {
    if (!autoRefresh || (!zipCode && (!latitude || !longitude))) return;

    const intervalId = setInterval(() => {
      handleSearch();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [
    autoRefresh,
    refreshInterval,
    zipCode,
    latitude,
    longitude,
    handleSearch,
  ]);

  // Handle ZIP code input change
  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow up to 5 digits
    const value = e.target.value.replace(/\D/g, '').substring(0, 5);
    setZipCode(value);
  };

  // Handle radius change
  const handleRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchRadius(Number(e.target.value));
  };

  return (
    <div className="p-2">
      <h2 className="text-lg font-semibold mb-4">Aircraft Geofence Tracker</h2>

      {/* Search Mode Tabs */}
      <div className="flex mb-4 border-b">
        <button
          className={`py-2 px-3 text-sm font-medium ${
            searchMode === 'zip'
              ? 'text-indigo-600 border-b-2 border-indigo-500'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setSearchMode('zip')}
        >
          Search by ZIP Code
        </button>

        <button
          className={`py-2 px-3 text-sm font-medium ${
            searchMode === 'location'
              ? 'text-indigo-600 border-b-2 border-indigo-500'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setSearchMode('location')}
        >
          Search by Coordinates
        </button>
      </div>

      {/* ZIP Code Search */}
      {searchMode === 'zip' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ZIP Code
          </label>
          <input
            type="text"
            value={zipCode}
            onChange={handleZipChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="Enter 5-digit ZIP code"
            maxLength={5}
          />
        </div>
      )}

      {/* Location Search */}
      {searchMode === 'location' && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Coordinates
            </label>

            <button
              onClick={getCurrentLocation}
              disabled={isFetchingLocation}
              className={`text-xs px-2 py-1 rounded ${
                isFetchingLocation
                  ? 'bg-gray-300 text-gray-500'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {isFetchingLocation ? 'Getting Location...' : 'Use My Location'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Latitude
              </label>
              <input
                type="text"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="e.g. 37.7749"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Longitude
              </label>
              <input
                type="text"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="e.g. -122.4194"
              />
            </div>
          </div>
        </div>
      )}

      {/* Search Radius (common to both modes) */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Search Radius: {searchRadius} km
        </label>
        <input
          type="range"
          min="5"
          max="100"
          step="5"
          value={searchRadius}
          onChange={handleRadiusChange}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>5 km</span>
          <span>100 km</span>
        </div>
      </div>

      {/* Search Button */}
      <div className="mb-4">
        <button
          onClick={handleSearch}
          disabled={
            isLoading ||
            (searchMode === 'zip' ? !zipCode : !latitude || !longitude)
          }
          className={`w-full px-4 py-2 rounded-md text-white font-medium ${
            isLoading ||
            (searchMode === 'zip' ? !zipCode : !latitude || !longitude)
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          {isLoading ? 'Searching...' : 'Search for Aircraft'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Status Info */}
      <div className="text-sm text-gray-500">
        {lastRefresh ? (
          <div>
            Last updated: {lastRefresh.toLocaleTimeString()}
            {autoRefresh && (
              <div className="text-xs mt-1">
                Auto-refreshing every {refreshInterval / 1000} seconds
              </div>
            )}
          </div>
        ) : (
          <div>Not searched yet</div>
        )}
      </div>
    </div>
  );
};

export default GeofenceTracker;
