// components/tracking/selector/UnifiedAircraftSelector.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import { ExtendedAircraft } from '@/types/base';

// Props interface
interface UnifiedAircraftSelectorProps {
  manufacturers: string[];
}

// Coordinate type
interface Coordinates {
  lat: number;
  lng: number;
}

const UnifiedAircraftSelector: React.FC<UnifiedAircraftSelectorProps> = ({
  manufacturers,
}) => {
  // Access map context
  const {
    mapInstance,
    setZoomLevel,
    displayedAircraft,
    cachedAircraftData,
    updateGeofenceAircraft,
    clearGeofenceData,
  } = useEnhancedMapContext();

  // State variables
  const [loading, setLoading] = useState<boolean>(false);
  const [geofenceLocation, setGeofenceLocation] = useState<string>('');
  const [geofenceCoordinates, setGeofenceCoordinates] =
    useState<Coordinates | null>(null);
  const [geofenceRadius, setGeofenceRadius] = useState<number>(25);
  const [geofenceAircraft, setGeofenceAircraft] = useState<ExtendedAircraft[]>(
    []
  );
  const [isGeofenceActive, setIsGeofenceActive] = useState<boolean>(false);
  const [geolocationError, setGeolocationError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<
    'manufacturer' | 'geofence' | 'both'
  >('both');
  const [selectedManufacturers, setSelectedManufacturers] = useState<string[]>(
    []
  );

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = useCallback(
    (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371; // Earth's radius in kilometers
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
          Math.cos(lat2 * (Math.PI / 180)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c; // Distance in kilometers
    },
    []
  );

  // Find aircraft within radius
  const findAircraftInRadius = useCallback(
    (center: Coordinates, radiusKm: number): ExtendedAircraft[] => {
      // Convert cached aircraft data to array
      const allAircraft: ExtendedAircraft[] = Object.values(cachedAircraftData)
        .filter(
          (aircraft) =>
            // Filter out aircraft with invalid coordinates
            typeof aircraft.latitude === 'number' &&
            typeof aircraft.longitude === 'number' &&
            // Only include recent data (within the last hour)
            aircraft.lastSeen &&
            Date.now() - aircraft.lastSeen < 3600000
        )
        .map((cachedAircraft) => ({
          ...cachedAircraft,
          // Add the required ExtendedAircraft properties
          type: cachedAircraft.TYPE_AIRCRAFT || 'unknown',
          isGovernment: cachedAircraft.OWNER_TYPE === '5',
          isTracked: true,
        })) as ExtendedAircraft[];

      return allAircraft.filter((aircraft: ExtendedAircraft) => {
        // Skip if no valid coordinates
        if (
          typeof aircraft.latitude !== 'number' ||
          typeof aircraft.longitude !== 'number'
        ) {
          return false;
        }

        // Calculate distance from center to aircraft
        const distance = calculateDistance(
          center.lat,
          center.lng,
          aircraft.latitude,
          aircraft.longitude
        );

        // Include if within radius
        return distance <= radiusKm;
      });
    },
    [cachedAircraftData, calculateDistance]
  );

  // Process geofence search
  const processGeofenceSearch = useCallback(() => {
    setLoading(true);

    // Basic validation
    if (!geofenceLocation.trim()) {
      setGeolocationError('Please enter a location');
      setLoading(false);
      return;
    }

    // If we already have coordinates (from location button or previous search)
    if (geofenceCoordinates) {
      const aircraftInRadius = findAircraftInRadius(
        geofenceCoordinates,
        geofenceRadius
      );
      setGeofenceAircraft(aircraftInRadius);
      setIsGeofenceActive(true);
      updateGeofenceAircraft(aircraftInRadius);
      setLoading(false);
      return;
    }

    // Parse coordinates from input if in format "lat, lng"
    const coordsMatch = geofenceLocation.match(
      /(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/
    );
    if (coordsMatch) {
      const lat = parseFloat(coordsMatch[1]);
      const lng = parseFloat(coordsMatch[2]);

      if (!isNaN(lat) && !isNaN(lng)) {
        const coords = { lat, lng };
        setGeofenceCoordinates(coords);
        const aircraftInRadius = findAircraftInRadius(coords, geofenceRadius);
        setGeofenceAircraft(aircraftInRadius);
        setIsGeofenceActive(true);

        // Update context with the filtered aircraft
        updateGeofenceAircraft(aircraftInRadius);

        // Update map view if map instance exists
        if (mapInstance) {
          mapInstance.setView([lat, lng], 10);
        }

        setLoading(false);
        return;
      }
    }

    // If not coordinates, try geocoding the location
    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(geofenceLocation)}`
    )
      .then((response) => response.json())
      .then((data) => {
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          const coords = { lat, lng };
          setGeofenceCoordinates(coords);
          const aircraftInRadius = findAircraftInRadius(coords, geofenceRadius);
          setGeofenceAircraft(aircraftInRadius);
          setIsGeofenceActive(true);

          // Update context with the filtered aircraft
          updateGeofenceAircraft(aircraftInRadius);

          // Update map view if map instance exists
          if (mapInstance) {
            mapInstance.setView([lat, lng], 10);
          }
        } else {
          setGeolocationError(
            'Location not found. Try a different search term.'
          );
        }
      })
      .catch((error) => {
        setGeolocationError('Error searching for location: ' + error.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [
    geofenceLocation,
    geofenceCoordinates,
    geofenceRadius,
    findAircraftInRadius,
    mapInstance,
    updateGeofenceAircraft,
  ]);

  // Handle current location request
  const handleCurrentLocation = useCallback(() => {
    // Reset any previous errors
    setGeolocationError(null);
    setLoading(true);

    // Request geolocation from browser
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Success handler
          const { latitude, longitude } = position.coords;

          // Set coordinates directly
          const coords = { lat: latitude, lng: longitude };
          setGeofenceCoordinates(coords);

          // Update map view if map instance exists
          if (mapInstance) {
            mapInstance.setView([latitude, longitude], 12);
            setZoomLevel(12);
          }

          // Try to get a readable location name using reverse geocoding
          fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          )
            .then((response) => response.json())
            .then((data) => {
              // Extract a readable location name
              const locationName = data.display_name
                ? data.display_name.split(',').slice(0, 3).join(', ')
                : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

              setGeofenceLocation(locationName);
              setIsGeofenceActive(true);

              // Process aircraft within the geofence radius
              const aircraftInRadius = findAircraftInRadius(
                coords,
                geofenceRadius
              );
              setGeofenceAircraft(aircraftInRadius);

              // Update context with the filtered aircraft
              updateGeofenceAircraft(aircraftInRadius);
            })
            .catch((error) => {
              // Fallback to coordinates if reverse geocoding fails
              setGeofenceLocation(
                `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
              );
              setIsGeofenceActive(true);

              // Process aircraft within the geofence radius
              const aircraftInRadius = findAircraftInRadius(
                coords,
                geofenceRadius
              );
              setGeofenceAircraft(aircraftInRadius);

              // Update context with the filtered aircraft
              updateGeofenceAircraft(aircraftInRadius);
            })
            .finally(() => {
              setLoading(false);
            });
        },
        (error) => {
          // Error handler
          let errorMessage = 'Unable to retrieve your location';

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage =
                'Location access denied. Please enable location services.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out.';
              break;
          }

          // Show error in UI
          setGeolocationError(errorMessage);
          setLoading(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    } else {
      // Browser doesn't support geolocation
      setGeolocationError('Geolocation is not supported by your browser');
      setLoading(false);
    }
  }, [
    findAircraftInRadius,
    geofenceRadius,
    mapInstance,
    setZoomLevel,
    updateGeofenceAircraft,
  ]);

  // Toggle manufacturer selection
  const toggleManufacturer = useCallback((manufacturerValue: string) => {
    setSelectedManufacturers((prev) => {
      if (prev.includes(manufacturerValue)) {
        return prev.filter((m) => m !== manufacturerValue);
      } else {
        return [...prev, manufacturerValue];
      }
    });
  }, []);

  // Handle radius change
  const handleRadiusChange = useCallback(
    (newRadius: number) => {
      setGeofenceRadius(newRadius);

      // If we have active coordinates, update the search with the new radius
      if (isGeofenceActive && geofenceCoordinates) {
        const aircraftInRadius = findAircraftInRadius(
          geofenceCoordinates,
          newRadius
        );
        setGeofenceAircraft(aircraftInRadius);

        // Update context with the filtered aircraft
        updateGeofenceAircraft(aircraftInRadius);
      }
    },
    [
      isGeofenceActive,
      geofenceCoordinates,
      findAircraftInRadius,
      updateGeofenceAircraft,
    ]
  );

  // Clear local geofence data
  const handleClearGeofence = useCallback(() => {
    setGeofenceLocation('');
    setGeofenceCoordinates(null);
    setGeofenceAircraft([]);
    setIsGeofenceActive(false);
    setGeolocationError(null);

    // Clear geofence data from context
    clearGeofenceData();
  }, [clearGeofenceData]);

  // Render component
  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Aircraft Selector
      </h3>

      {/* Filter mode tabs */}
      <div className="flex mb-4 border-b">
        <button
          className={`px-4 py-2 font-medium text-sm ${
            filterMode === 'manufacturer'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setFilterMode('manufacturer')}
        >
          By Manufacturer
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm ${
            filterMode === 'geofence'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setFilterMode('geofence')}
        >
          By Location
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm ${
            filterMode === 'both'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setFilterMode('both')}
        >
          Combined
        </button>
      </div>

      {/* Manufacturer filter section */}
      {(filterMode === 'manufacturer' || filterMode === 'both') && (
        <div className="mb-4">
          <div className="mb-2 flex justify-between items-center">
            <label className="text-sm font-medium text-gray-700">
              Manufacturers
            </label>
            {selectedManufacturers.length > 0 && (
              <button
                onClick={() => setSelectedManufacturers([])}
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                Clear
              </button>
            )}
          </div>

          <div className="max-h-40 overflow-y-auto pr-2">
            {manufacturers.sort().map((manufacturer) => (
              <div key={manufacturer} className="flex items-center mb-1">
                <input
                  type="checkbox"
                  id={`mfr-${manufacturer}`}
                  checked={selectedManufacturers.includes(manufacturer)}
                  onChange={() => toggleManufacturer(manufacturer)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label
                  htmlFor={`mfr-${manufacturer}`}
                  className="ml-2 text-sm text-gray-700"
                >
                  {manufacturer || 'Unknown'}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Geofence Filter Section */}
      {(filterMode === 'geofence' || filterMode === 'both') && (
        <div className="mb-4">
          <div className="mb-2 flex justify-between items-center">
            <label className="text-sm font-medium text-gray-700">
              Location Search
            </label>
            {isGeofenceActive && (
              <button
                onClick={handleClearGeofence}
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex space-x-2">
            <div className="relative flex-1">
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="ZIP code, city, or coordinates..."
                value={geofenceLocation}
                onChange={(e) => setGeofenceLocation(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !loading && geofenceLocation) {
                    processGeofenceSearch();
                  }
                }}
              />
              <button
                onClick={handleCurrentLocation}
                className="absolute right-0 inset-y-0 px-3 flex items-center justify-center text-gray-500 hover:text-indigo-600"
                title="Use my current location"
                disabled={loading}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>
            </div>
            <button
              className={`px-3 py-2 rounded-md text-white ${
                loading || !geofenceLocation
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
              onClick={processGeofenceSearch}
              disabled={loading || !geofenceLocation}
            >
              {loading ? (
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
                'Search'
              )}
            </button>
          </div>

          {/* Geolocation error message */}
          {geolocationError && (
            <div className="mt-1 text-xs text-red-500">{geolocationError}</div>
          )}

          {/* Radius slider control */}
          <div className="mt-3">
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Radius: {geofenceRadius} km
            </label>
            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={geofenceRadius}
              onChange={(e) => handleRadiusChange(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>5 km</span>
              <span>50 km</span>
              <span>100 km</span>
            </div>
          </div>

          {/* Active geofence information */}
          {isGeofenceActive && geofenceCoordinates && (
            <div className="mt-2 bg-gray-50 p-2 rounded-md text-xs text-gray-600">
              <div className="font-medium text-indigo-700 mb-1">
                {geofenceAircraft.length} aircraft found
              </div>
              <div>Location: {geofenceLocation}</div>
              <div>
                Coordinates: {geofenceCoordinates.lat.toFixed(4)},{' '}
                {geofenceCoordinates.lng.toFixed(4)}
              </div>
              <div>Radius: {geofenceRadius} km</div>
              {geofenceAircraft.length > 0 && (
                <div className="mt-1 max-h-16 overflow-y-auto">
                  <div className="text-xs font-medium text-gray-700">
                    Nearest aircraft:
                  </div>
                  {geofenceAircraft
                    .sort((a, b) => {
                      // Sort by closest distance if latitude/longitude available
                      if (
                        typeof a.latitude === 'number' &&
                        typeof a.longitude === 'number' &&
                        typeof b.latitude === 'number' &&
                        typeof b.longitude === 'number' &&
                        geofenceCoordinates
                      ) {
                        const distA = calculateDistance(
                          geofenceCoordinates.lat,
                          geofenceCoordinates.lng,
                          a.latitude,
                          a.longitude
                        );
                        const distB = calculateDistance(
                          geofenceCoordinates.lat,
                          geofenceCoordinates.lng,
                          b.latitude,
                          b.longitude
                        );
                        return distA - distB;
                      }
                      return 0;
                    })
                    .slice(0, 3)
                    .map((aircraft) => (
                      <div key={aircraft.icao24} className="text-xs mt-0.5">
                        {aircraft.icao24} •{' '}
                        {aircraft.model || aircraft.TYPE_AIRCRAFT || 'Unknown'}{' '}
                        •
                        {typeof aircraft.latitude === 'number' &&
                        typeof aircraft.longitude === 'number'
                          ? ` ${calculateDistance(
                              geofenceCoordinates.lat,
                              geofenceCoordinates.lng,
                              aircraft.latitude,
                              aircraft.longitude
                            ).toFixed(1)} km away`
                          : ' Distance unknown'}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Status display */}
      <div className="text-xs text-gray-500 mt-2">
        {filterMode === 'both' &&
          selectedManufacturers.length > 0 &&
          isGeofenceActive && (
            <div>
              Filtering by both manufacturer ({selectedManufacturers.length})
              and location
            </div>
          )}
        {filterMode === 'manufacturer' && selectedManufacturers.length > 0 && (
          <div>Showing {selectedManufacturers.length} manufacturer(s)</div>
        )}
        {filterMode === 'geofence' && isGeofenceActive && (
          <div>Showing aircraft within {geofenceRadius}km of location</div>
        )}
      </div>
    </div>
  );
};

export default UnifiedAircraftSelector;
