import { useState, useRef, useEffect } from 'react';
import React from 'react';
import type { ExtendedAircraft } from '@/types/base';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import openSkyTrackingService from '@/lib/services/openSkyTrackingService';
import { MapboxService } from '../../../lib/services/MapboxService';
import { adaptGeofenceAircraft } from '@/lib/utils/geofenceAdapter';
import { enrichGeofenceAircraft } from '@/lib/utils/geofenceEnricher';
import { useGeolocationServices } from '../hooks/useGeolocationServices';
import {
  getAircraftNearLocation,
  getAircraftNearSearchedLocation,
} from '../../../lib/services/geofencing';

interface FilterLogicResult {
  geofenceLocation: string;
  geofenceRadius: number;
  isGettingLocation: boolean;
  isGeofenceActive: boolean;
  geofenceCoordinates: { lat: number; lng: number } | null;
  combinedLoading: boolean;
  processGeofenceSearch: () => void;
  toggleGeofenceState: (active: boolean) => void;
  setGeofenceLocation: (location: string) => void;
  setGeofenceRadius: (radius: number) => void;
  setGeofenceCoordinates: (coords: { lat: number; lng: number } | null) => void;
  setGeofenceCenter: (coords: { lat: number; lng: number }) => void;
  setIsGettingLocation: (isGetting: boolean) => void;
  updateGeofenceAircraft: (aircraft: any[]) => void;
}

export function useFilterLogic() {
  // Get context state and functions
  const {
    selectedModel,
    selectManufacturer,
    selectModel,
    reset,
    fullRefresh,
    refreshPositions,
    mapInstance,
    updateAircraftData,
    clearGeofenceData,
    refreshPanel,
    updateGeofenceAircraft,
    setBlockManufacturerApiCalls,
    setIsManufacturerApiBlocked,
    geofenceCenter,
    setGeofenceCenter,
    toggleGeofence,
    clearGeofence,
  } = useEnhancedMapContext();

  // Use our combined geolocation services hook
  const geolocationServices = useGeolocationServices();

  // Geofence state
    const [localLoading, setLocalLoading] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [geofenceLocation, setGeofenceLocation] = useState<string>('');
  const [geofenceRadius, setGeofenceRadius] = useState<number>(25);
  const [geofenceCoordinates, setGeofenceCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [geofenceAircraft, setGeofenceAircraft] = useState<ExtendedAircraft[]>(
    []
  );
  const [geofenceEnabled, setGeofenceEnabled] = useState(false);
  const [isGeofenceActive, setIsGeofenceActive] = useState(false);
  const [isSearchReady, setIsSearchReady] = React.useState(false);
   const [isRateLimited, setIsRateLimited] = useState(false);
  const [rateLimitTimer, setRateLimitTimer] = useState<number | null>(null);



  // Geofence methods
  // Fixed getUserLocation function to use the geolocation hook

  const handleRateLimit = (retryAfter: number = 30) => {
    setIsRateLimited(true);
    setRateLimitTimer(retryAfter);
    console.log(`Rate limited by API. Retry after ${retryAfter}s`);

    // Block all API calls
    openSkyTrackingService.setBlockAllApiCalls(true);
    setBlockManufacturerApiCalls(true);

    // Show notification to user
    if (retryAfter > 0) {
      alert(
        `Aircraft data refresh rate limited. Please wait ${retryAfter} seconds before trying again.`
      );
    }
  };


  const getUserLocation = async () => {


    setIsGettingLocation(true);
    try {
      // Use the getCurrentPosition from our combined hook
      const position = await geolocationServices.getCurrentPosition();

      if (position) {
        const { latitude, longitude } = position.coords;

        // Update state with coordinates
        setGeofenceCoordinates({ lat: latitude, lng: longitude });
        setGeofenceCenter({ lat: latitude, lng: longitude });

        // Update the location display with coordinates
        setGeofenceLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);

        // Automatically trigger the geofence search
        try {
          const fetchedAircraft = await getAircraftNearLocation(
            latitude,
            longitude,
            geofenceRadius
          );

          if (fetchedAircraft.length === 0) {
            alert(
              `No aircraft found near your current location. Try increasing the radius.`
            );
            setIsGettingLocation(false);
            return;
          }

          // Process the aircraft data
          const adaptedAircraft = adaptGeofenceAircraft(fetchedAircraft);
          const enrichedAircraft =
            await enrichGeofenceAircraft(adaptedAircraft);

          // Save to local state
          setGeofenceAircraft(enrichedAircraft);

          // Clear existing aircraft data
          if (clearGeofenceData) {
            clearGeofenceData();
          }

          // Update the map with new aircraft
          updateGeofenceAircraft(enrichedAircraft);
          setIsGeofenceActive(true);

          // Center the map on user's location - SIMPLIFIED ZOOM LOGIC
          if (mapInstance) {
            // Don't modify zoom if it's already at an appropriate level
            const currentZoom = mapInstance.getZoom();
            const targetZoom = currentZoom <= 7 ? 9 : currentZoom;

            // Set the view directly to the user's location
            mapInstance.setView([latitude, longitude], targetZoom);

            // Make sure the map reflects changes
            mapInstance.invalidateSize();
          }

          
        } catch (error: any) {
          if (error.message?.includes('rate limit') || error.status === 429) {
            handleRateLimit(30);
            // Still update the location even if we couldn't get aircraft
            if (mapInstance) {
              mapInstance.setView([latitude, longitude], 9);
              mapInstance.invalidateSize();
            }
          } else {
            throw error;
          }
        }

    
      }
    } catch (error) {
      console.error('Error getting user location:', error);
      alert(
        'Unable to access your location. Please make sure location services are enabled in your browser.'
      );
    } finally {
      setIsGettingLocation(false);
    }
  };

  const processGeofenceSearch = async (fromPanel = false) => {
    if (!geofenceLocation) return;

    

    try {
      console.log(
        `Searching for aircraft near location: "${geofenceLocation}"`
      );

      // This will handle Postal codes, place names, addresses, POIs, etc.
      let fetchedAircraft;
      try {
        fetchedAircraft = await getAircraftNearSearchedLocation(
          geofenceLocation,
          geofenceRadius
        );
      } catch (error: any) {
        if (error.message?.includes('rate limit') || error.status === 429) {
          const retryAfter = 30; // Default to 30 seconds if not specified
          handleRateLimit(retryAfter);
          setLocalLoading(false);
          return;
        }
        throw error;
      }

      // Get coordinates for the map
      let locations: { lat: number; lng: number; name: string }[];
      try {
        locations = await MapboxService.searchLocationWithMapbox(
          geofenceLocation,
          1
        );
      } catch (error) {
        console.error('Error searching location with Mapbox:', error);
        // Continue with aircraft data if available
        locations = [];
      }

      let coordinates: { lat: number; lng: number } | null = null;

      if (locations.length > 0) {
        coordinates = {
          lat: locations[0].lat,
          lng: locations[0].lng,
        };
        // Save the formatted location name
        setGeofenceLocation(locations[0].name);
      } else if (
        fetchedAircraft.length > 0 &&
        fetchedAircraft[0].latitude &&
        fetchedAircraft[0].longitude
      ) {
        // Fallback to first aircraft position
        coordinates = {
          lat: fetchedAircraft[0].latitude,
          lng: fetchedAircraft[0].longitude,
        };
      }

      if (fetchedAircraft.length === 0) {
        alert(
          `No aircraft found near ${geofenceLocation}. Try increasing the radius or searching in a different area.`
        );
        setLocalLoading(false);
        return;
      }

      // Update state with the coordinates
      if (coordinates) {
        setGeofenceCoordinates(coordinates);
        setGeofenceCenter(coordinates);
        setGeofenceRadius(geofenceRadius);
      }
      if (!isGeofenceActive) {
        toggleGeofence();
      } else if (!coordinates) {
        throw new Error('Could not determine coordinates for the location');
      }

      console.log(
        `Found ${fetchedAircraft.length} aircraft in the area, preparing for display...`
      );

      // Ensure the data is in the right format
      const adaptedAircraft =
        fetchedAircraft[0].MANUFACTURER !== undefined
          ? fetchedAircraft // Already in the right format
          : adaptGeofenceAircraft(fetchedAircraft); // Needs adaptation

      // Enrich with static data
      console.log('Enriching geofence aircraft with static data...');
      const enrichedAircraft = await enrichGeofenceAircraft(adaptedAircraft);

        // Save the FULL set to local state
        setGeofenceAircraft(enrichedAircraft);
        setIsGeofenceActive(true);
      } catch (error) {
        console.error('Error processing geofence search:', error);
      }



  /**
   * STEP 3: Fix toggleGeofenceState to better handle manually clicking the button
   */
  const toggleGeofenceState = (enabled: boolean) => {
    console.log('toggleGeofenceState called with:', enabled);
    console.log('Current geofenceCoordinates:', geofenceCoordinates);

    if (enabled) {
      // Check if we have valid coordinates
      if (
        geofenceCoordinates &&
        typeof geofenceCoordinates.lat === 'number' &&
        typeof geofenceCoordinates.lng === 'number' &&
        !isNaN(geofenceCoordinates.lat) &&
        !isNaN(geofenceCoordinates.lng)
      ) {
        console.log('Valid coordinates found, enabling geofence');

        // Set flags first
        setGeofenceEnabled(true);
        setIsGeofenceActive(true);

        // Call context toggle function if available
        if (typeof toggleGeofence === 'function') {
          toggleGeofence();
        }

        // Display aircraft if we have them
        if (geofenceAircraft && geofenceAircraft.length > 0) {
          console.log(
            `Showing ${geofenceAircraft.length} aircraft in geofence`
          );
          updateGeofenceAircraft(geofenceAircraft);
        } else {
          // No aircraft data yet, trigger a search
          console.log('No aircraft data yet, triggering search');
          setTimeout(() => {
            processGeofenceSearch();
          }, 100);
        }
      } else {
        // No valid coordinates
        console.warn('No valid coordinates, showing alert');
        alert(
          'Please set a location before enabling geofence.\n\nClick anywhere on the map to set a location.'
        );
        setGeofenceEnabled(false);
        setIsGeofenceActive(false);
      }
    } else {
      // Disabling geofence
      console.log('Disabling geofence');
      setGeofenceEnabled(false);
      setIsGeofenceActive(false);

      // Clear geofence data if function available
      if (typeof clearGeofenceData === 'function') {
        clearGeofenceData();
      }
    }
  };

  // Effects

  React.useEffect(() => {
    if (geofenceCoordinates) {
      setIsSearchReady(true);
    }
  }, [geofenceCoordinates]);



  // Effect to sync geofence state
  useEffect(() => {
    // Update internal state when geofence is toggled externally
    if (isGeofenceActive !== geofenceEnabled) {
      setGeofenceEnabled(isGeofenceActive);
    }
  }, [isGeofenceActive]);



  // Effect to handle map click for geofence
  useEffect(() => {
    const handleMapGeofenceClick = async (event: Event) => {
      try {
        // Cast the event to the proper type
        const customEvent = event as CustomEvent<{ lat: number; lng: number }>;
        const { lat, lng } = customEvent.detail;

        // First update coordinates immediately
        setGeofenceCoordinates({ lat, lng });

        // Then start an async operation to get the location name
        console.log(`Getting location name for: ${lat}, ${lng}`);

        // Temporarily show coordinates while fetching the name
        setGeofenceLocation(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);

        // Get the friendly name asynchronously
        const locationName = await MapboxService.getLocationNameFromCoordinates(
          lat,
          lng
        );
        console.log(`Got location name: ${locationName}`);

        // Update with the friendly name once we have it
        if (locationName !== null) {
          setGeofenceLocation(locationName);
        }

      } catch (error) {
        console.error('Error handling map click:', error);
        // Keep the coordinates display if there was an error
      }
    };

    // Add the event listener - use the standard event listener pattern
    document.addEventListener(
      'map-geofence-click',
      handleMapGeofenceClick as EventListener
    );

    // Clean up
    return () => {
      document.removeEventListener(
        'map-geofence-click',
        handleMapGeofenceClick as EventListener
      );
    };
  }, [
    setGeofenceLocation,
    setGeofenceCoordinates,

  ]);

 

  // Reset all filters
  const clearAllFilters = () => {
    console.log('Clearing all filters...');


    // 2. Unblock API calls that might have been blocked
    openSkyTrackingService.setBlockAllApiCalls(false);
    setBlockManufacturerApiCalls(false);
    setIsManufacturerApiBlocked(false);

    // 3. Clear manufacturer selection
    selectManufacturer(null);
    selectModel(null);

    // 4. Clear geofence
    setGeofenceLocation('');
    setGeofenceCoordinates(null);
    setGeofenceAircraft([]);
    setGeofenceEnabled(false);
    setIsGeofenceActive(false);
    if (typeof clearGeofence === 'function') {
      clearGeofence();
    }
    if (typeof clearGeofenceData === 'function') {
      clearGeofenceData();
    }

    // Add this line to clear locationName
    setLocationName(null); // or setLocationName('') depending on how you handle empty states



    setGeofenceLocation(''); // ✅ ← this clears the ribbon display
    setGeofenceRadius(25); // or whatever your default is



    // 13. Dispatch a custom event that other components can listen for
    const clearEvent = new CustomEvent('ribbon-filters-cleared');
    document.dispatchEvent(clearEvent);

    console.log('All filters cleared successfully');
  };



  return {
    // State

    selectedModel,
    geofenceLocation,
 geofenceRadius,
    isGeofenceActive,
    geofenceCoordinates,
    getUserLocation,
    isGettingLocation,
     isGeofencePlacementMode: false, // Initialize with a default value

    // Methods
    
    processGeofenceSearch,
    setGeofenceLocation,
    setGeofenceRadius,
    toggleGeofenceState,
    clearAllFilters,
    setLocationName,
    setGeofenceCoordinates,
    setGeofenceCenter,
    setIsGettingLocation,
    updateGeofenceAircraft,
  };
}}