import { useState, useRef, useEffect } from 'react';
import { RegionCode } from '@/types/base';
import type { ExtendedAircraft } from '@/types/base';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import openSkyTrackingService from '@/lib/services/openSkyTrackingService';
import {
  getAircraftNearLocation,
  searchLocationWithMapbox,
  getAircraftNearSearchedLocation,
} from '@/lib/services/geofencing';
import { adaptGeofenceAircraft } from '@/lib/utils/geofenceAdapter';
import { enrichGeofenceAircraft } from '@/lib/utils/geofenceEnricher';
import { useGeolocation } from '../hooks/useGeolocation';
import {
  MAP_CONFIG,
  getBoundsByRegion,
  getZoomLevelForRegion,
} from '../../../config/map';

export type FilterMode =
  | 'manufacturer'
  | 'geofence'
  | 'both'
  | 'owner'
  | 'region';

export function useFilterLogic() {
  // Get context state and functions
  const {
    selectedManufacturer,
    selectedModel,
    totalActive,
    selectManufacturer,
    selectModel,
    reset,
    fullRefresh,
    refreshPositions,
    mapInstance,
    updateAircraftData,
    clearGeofenceData,
    updateGeofenceAircraft,
    blockManufacturerApiCalls,
    setBlockManufacturerApiCalls,
    isManufacturerApiBlocked,
    setIsManufacturerApiBlocked,
    geofenceCenter,
    setGeofenceCenter,
    toggleGeofence,
    clearGeofence,
    displayedAircraft,
  } = useEnhancedMapContext();

  // Get geolocation hook
  const { getCurrentPosition } = useGeolocation();

  // Local state
  const [localLoading, setLocalLoading] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [manufacturerSearchTerm, setManufacturerSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [rateLimitTimer, setRateLimitTimer] = useState<number | null>(null);

  // Geofence state
  const [isGettingLocation, setIsGettingLocation] = useState(false);
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

  // Region state
  const [activeRegion, setActiveRegion] = useState<RegionCode | string | null>(
    null
  );
  const [regionOutline, setRegionOutline] = useState<any>(null);
  const [selectedRegion, setSelectedRegion] = useState<number>(
    RegionCode.GLOBAL
  );

  // Combined mode state
  const [combinedModeReady, setCombinedModeReady] = useState<boolean>(false);

  // Owner filter state
  const allOwnerTypes = [
    'individual',
    'partnership',
    'corp-owner',
    'co-owned',
    'llc',
    'non-citizen-corp',
    'airline',
    'freight',
    'medical',
    'media',
    'historical',
    'flying-club',
    'emergency',
    'local-govt',
    'education',
    'federal-govt',
    'flight-school',
    'leasing-corp',
    'military',
    'unknown',
  ];

  const [ownerFilters, setOwnerFilters] = useState<string[]>([
    ...allOwnerTypes,
  ]);

  // Refs for dropdown handling
  const dropdownRefs = {
    filter: useRef<HTMLDivElement>(null),
    manufacturer: useRef<HTMLDivElement>(null),
    model: useRef<HTMLDivElement>(null),
    location: useRef<HTMLDivElement>(null),
    region: useRef<HTMLDivElement>(null),
    owner: useRef<HTMLDivElement>(null),
    actions: useRef<HTMLDivElement>(null),
  };

  // Effects
  useEffect(() => {
    if (isRateLimited && rateLimitTimer) {
      const timer = setTimeout(() => {
        setIsRateLimited(false);
        setRateLimitTimer(null);
        console.log('Rate limit timer expired, resuming API calls');
      }, rateLimitTimer * 1000);

      return () => clearTimeout(timer);
    }
  }, [isRateLimited, rateLimitTimer]);

  // Effect to sync geofence state
  useEffect(() => {
    // Update internal state when geofence is toggled externally
    if (isGeofenceActive !== geofenceEnabled) {
      setGeofenceEnabled(isGeofenceActive);
    }
  }, [isGeofenceActive]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside of all dropdowns
      const isOutsideAll = Object.values(dropdownRefs).every(
        (ref) => !ref.current || !ref.current.contains(event.target as Node)
      );

      if (isOutsideAll) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Clean up region outline when component unmounts
  useEffect(() => {
    return () => {
      if (regionOutline) {
        regionOutline.remove();
      }
    };
  }, [regionOutline]);

  // Effect to handle map click for geofence
  useEffect(() => {
    // Handler for map click events
    const handleMapGeofenceClick = (event: any) => {
      const { lat, lng } = event.detail;
      console.log(
        `useFilterLogic received map click at: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
      );

      // Update the geofence coordinates
      setGeofenceCoordinates({ lat, lng });

      // Update the location display with formatted coordinates
      setGeofenceLocation(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);

      // Open the location dropdown if it's not already open
      if (activeDropdown !== 'location') {
        setActiveDropdown('location');
      }
    };

    // Add the event listener
    document.addEventListener('map-geofence-click', handleMapGeofenceClick);

    // Clean up
    return () => {
      document.removeEventListener(
        'map-geofence-click',
        handleMapGeofenceClick
      );
    };
  }, []); // Empty dependency array means this runs once on mount

  // Main methods
  const toggleDropdown = (dropdown: string, event: React.MouseEvent) => {
    if (activeDropdown === dropdown) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown(dropdown);
    }
    // Prevent events from bubbling up
    event.stopPropagation();
  };

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

  /**
   * Toggle filter mode
   */
  const toggleFilterMode = (mode: FilterMode) => {
    setFilterMode(mode);
    setActiveDropdown(null);

    // Apply appropriate filters based on new mode
    if (mode === 'region') {
      // Block API calls in region mode
      openSkyTrackingService.setBlockAllApiCalls(true);

      // Apply region filtering if we already have data
      if (displayedAircraft && displayedAircraft.length > 0) {
        filterAircraftByRegion(selectedRegion.toString());
      }

      // Clear manufacturer selection from the UI
      selectManufacturer(null);
      selectModel(null);

      // If geofence is active, restore the full geofence data
      if (geofenceCoordinates && geofenceAircraft.length > 0) {
        updateGeofenceAircraft(geofenceAircraft);
      }
    } else if (mode === 'owner') {
      // Filter displayed aircraft by owner type
      if (displayedAircraft && displayedAircraft.length > 0) {
        // First filter for valid coordinates
        const aircraftWithValidCoords = displayedAircraft.filter(
          (plane) =>
            typeof plane.latitude === 'number' &&
            typeof plane.longitude === 'number' &&
            !isNaN(plane.latitude) &&
            !isNaN(plane.longitude)
        );

        // Apply owner type filter
        let filteredByOwner =
          ownerFilters.length === 0
            ? aircraftWithValidCoords
            : aircraftWithValidCoords.filter((aircraft) =>
                ownerFilters.includes(getAircraftOwnerType(aircraft))
              );

        // Update display with filtered aircraft
        if (clearGeofenceData) {
          clearGeofenceData();
        }
        updateGeofenceAircraft(filteredByOwner);
      }
    } else if (mode === 'both') {
      // Both mode - BLOCK API CALLS
      openSkyTrackingService.setBlockAllApiCalls(true);

      if (
        selectedManufacturer &&
        isGeofenceActive &&
        geofenceAircraft.length > 0
      ) {
        applyCombinedFilters();
      } else {
        // If one is missing, prompt the user
        if (!selectedManufacturer && isGeofenceActive) {
          alert('Please select a manufacturer to use combined filter mode');
        } else if (selectedManufacturer && !isGeofenceActive) {
          alert('Please set a location to use combined filter mode');
        } else {
          alert(
            'Please select both a manufacturer and location to use combined filter mode'
          );
        }
      }
    }
  };

  // Owner filter methods
  const getAircraftOwnerType = (aircraft: ExtendedAircraft): string => {
    const ownerType = aircraft.TYPE_REGISTRANT || 0;
    return ownerTypeToString(ownerType);
  };

  const ownerTypeToString = (type: number | string): string => {
    const typeNum = typeof type === 'string' ? parseInt(type, 10) : type;

    const ownerTypeMap: Record<number, string> = {
      1: 'individual',
      2: 'partnership',
      3: 'corp-owner',
      4: 'co-owned',
      7: 'llc',
      8: 'non-citizen-corp',
      9: 'airline',
      10: 'freight',
      11: 'medical',
      12: 'media',
      13: 'historical',
      14: 'flying-club',
      15: 'emergency',
      16: 'local-govt',
      17: 'education',
      18: 'federal-govt',
      19: 'flight-school',
      20: 'leasing-corp',
      21: 'military',
    };

    return ownerTypeMap[typeNum] || 'unknown';
  };

  const applyOwnerTypeFilter = (filters: string[]) => {
    // Skip filtering if all types are selected or none are selected
    if (filters.length === 0 || filters.length === allOwnerTypes.length) {
      return;
    }

    // Filter the aircraft based on selected owner types
    if (displayedAircraft && displayedAircraft.length > 0) {
      const filteredAircraft = displayedAircraft.filter((aircraft) => {
        const ownerType = getAircraftOwnerType(aircraft);
        return filters.includes(ownerType);
      });

      // Update the displayed aircraft
      if (clearGeofenceData) {
        clearGeofenceData();
      }
      updateGeofenceAircraft(filteredAircraft);
    }
  };

  const handleOwnerFilterChange = (updatedFilters: string[]) => {
    setOwnerFilters(updatedFilters);
    // Apply the filter to your aircraft data
    applyOwnerTypeFilter(updatedFilters);
  };

  const resetOwnerFilters = () => {
    setOwnerFilters([...allOwnerTypes]);
  };

  // Region filter methods
  const filterAircraftByRegion = (region: string) => {
    if (!displayedAircraft || displayedAircraft.length === 0) return;
    setLocalLoading(true);

    try {
      // Get the bounds for the selected region
      const boundsExpression = getBoundsByRegion(region);

      // Ensure bounds is in the correct format
      if (!Array.isArray(boundsExpression) || boundsExpression.length !== 2) {
        console.error(
          `Invalid bounds format for region: ${region}`,
          boundsExpression
        );
        setLocalLoading(false);
        return;
      }

      // Extract coordinates - Leaflet uses [lat, lng] format
      const [[minLat, minLng], [maxLat, maxLng]] = boundsExpression;

      console.log(`Filtering by region: ${region} with bounds:`, {
        minLat,
        minLng,
        maxLat,
        maxLng,
      });

      // Filter aircraft based on coordinates within the bounds
      const filteredAircraft = displayedAircraft.filter((aircraft) => {
        // Check if aircraft has valid coordinates
        if (
          typeof aircraft.latitude !== 'number' ||
          typeof aircraft.longitude !== 'number' ||
          isNaN(aircraft.latitude) ||
          isNaN(aircraft.longitude)
        ) {
          return false;
        }

        // Check if coordinates are within the bounds
        return (
          aircraft.latitude >= minLat &&
          aircraft.latitude <= maxLat &&
          aircraft.longitude >= minLng &&
          aircraft.longitude <= maxLng
        );
      });

      // Update the display with filtered aircraft
      if (clearGeofenceData) {
        clearGeofenceData();
      }
      updateGeofenceAircraft(filteredAircraft);
      console.log(
        `Filtered to ${filteredAircraft.length} aircraft in ${region} region (out of ${displayedAircraft.length} total)`
      );
    } catch (error) {
      console.error('Error filtering aircraft by region:', error);
    } finally {
      setLocalLoading(false);
    }
  };

  const handleRegionSelect = async (region: RegionCode) => {
    setActiveRegion(region);
    setSelectedRegion(region);
    setLocalLoading(true);

    try {
      // Set map bounds based on region
      if (mapInstance) {
        const bounds = getBoundsByRegion(region);

        // Get the appropriate zoom level for this region from your config
        const zoomLevel = getZoomLevelForRegion(region);

        // First, set the appropriate zoom level
        mapInstance.setZoom(zoomLevel);

        // Then fit bounds with padding
        const options = {
          padding: MAP_CONFIG.PADDING.DEFAULT,
          // Don't set maxZoom here as we want the region to be properly displayed
        };

        mapInstance.fitBounds(bounds as any, options);
        mapInstance.invalidateSize();
        drawRegionOutline(region);
      }

      // Instead of immediately fetching aircraft data,
      // just store the region selection for later use
      console.log(`Region selected. Waiting for manufacturer selection...`);

      // Optionally, you could fetch just the count of aircraft in this region
      // to give the user an idea of the data volume
      const countResponse = await fetch(
        `/api/tracking/region-count?region=${region}`
      );
      if (countResponse.ok) {
        const countData = await countResponse.json();
        console.log(`${countData.count} aircraft available in this region`);
      }

      // Clear any previous aircraft data
      if (clearGeofenceData) {
        clearGeofenceData();
      }
    } catch (error) {
      console.error('Error in region selection:', error);
    } finally {
      setLocalLoading(false);
      setActiveDropdown(null);
    }
  };

  const drawRegionOutline = (region: RegionCode) => {
    if (!mapInstance) return;

    // Clear any existing outline
    if (regionOutline) {
      regionOutline.remove();
    }

    // Get the bounds for the selected region
    const bounds = getBoundsByRegion(region) as [
      [number, number],
      [number, number],
    ];

    // Create a polygon from the bounds
    const L = require('leaflet');
    const rectangle = L.rectangle(bounds, {
      color: '#4f46e5', // Indigo color matching your UI
      weight: 3,
      opacity: 0.7,
      fill: true,
      fillColor: '#4f46e5',
      fillOpacity: 0.1,
      dashArray: '5, 10', // Optional: creates a dashed line
      interactive: false, // Prevents the rectangle from capturing mouse events
    });

    // Add to map
    rectangle.addTo(mapInstance);

    // Update the state to include both the rectangle and the label
    setRegionOutline({
      remove: () => {
        rectangle.remove();
      },
    });
  };

  // Geofence methods
  // Fixed getUserLocation function
  const getUserLocation = async () => {
    if (isRateLimited) {
      alert(
        `Rate limited. Please wait ${rateLimitTimer || 30} seconds before trying to get location.`
      );
      return;
    }

    setIsGettingLocation(true);
    try {
      const position = await getCurrentPosition();

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

          // If in geofence mode, ensure the filter mode is set correctly
          if (filterMode !== 'geofence' && filterMode !== 'both') {
            setFilterMode('geofence');
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

        // Close the dropdown after selection
        setActiveDropdown(null);
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

  const processGeofenceSearch = async () => {
    if (!geofenceLocation) return;

    // Check if rate limited
    if (isRateLimited) {
      alert(
        `Rate limited. Please wait ${rateLimitTimer || 30} seconds before searching again.`
      );
      return;
    }

    // Block API calls while doing geofence search in combined mode
    if (filterMode === 'both') {
      openSkyTrackingService.setBlockAllApiCalls(true);
      setBlockManufacturerApiCalls(true);
    }

    // Set loading state
    setLocalLoading(true);

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
        locations = await searchLocationWithMapbox(geofenceLocation, 1);
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

      // Clear existing aircraft data
      if (clearGeofenceData) {
        clearGeofenceData();
      }

      // If we're in combined mode and have a manufacturer, apply the combined filter
      if (filterMode === 'both' && selectedManufacturer) {
        // Make sure API calls remain blocked
        openSkyTrackingService.setBlockAllApiCalls(true);
        setBlockManufacturerApiCalls(true);
        setTimeout(() => {
          applyCombinedFilters();
        }, 100);
      } else {
        // Just show all aircraft in the geofence
        updateGeofenceAircraft(enrichedAircraft);

        // Center the map - SIMPLIFIED ZOOM LOGIC
        if (mapInstance && coordinates) {
          // Get current zoom level
          const currentZoom = mapInstance.getZoom();
          // Use appropriate zoom level based on current view
          const targetZoom = currentZoom <= 7 ? 9 : currentZoom;

          // Set view to the coordinates
          mapInstance.setView([coordinates.lat, coordinates.lng], targetZoom);

          // Ensure map is updated
          mapInstance.invalidateSize();
        }
      }

      // Close dropdown after search
      setActiveDropdown(null);
    } catch (error: any) {
      console.error('Error in geofence search:', error);
      if (error.message?.includes('rate limit') || error.status === 429) {
        handleRateLimit(30);
      } else {
        alert(
          `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
        );
      }
    } finally {
      setLocalLoading(false);
    }
  };

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

  // Manufacturer filter methods
  const selectManufacturerAndClose = (value: string) => {
    // Close dropdown
    setActiveDropdown(null);
    setManufacturerSearchTerm('');

    // If clearing the selection
    if (value === '') {
      selectManufacturer(null);
      return;
    }

    // Set the manufacturer selection
    selectManufacturer(value);

    // If region is already selected, fetch filtered data
    if (activeRegion !== null) {
      fetchAircraftByRegionAndManufacturer(activeRegion as RegionCode, value);
    } else {
      // Otherwise, just proceed with manufacturer-only filtering as before
      fetchManufacturerData(value);
    }
  };

  const fetchManufacturerData = (manufacturer: string) => {
    if (isRateLimited) {
      console.log(`Skipping data fetch - rate limited for ${rateLimitTimer}s`);
      return;
    }

    console.log(`Fetching data for manufacturer: ${manufacturer}`);

    try {
      // If you have a context function for this, call it after a slight delay
      if (typeof refreshPositions === 'function') {
        // Apply a small delay to prevent overwhelming the API
        setTimeout(() => {
          refreshPositions().catch((error: any) => {
            if (error.message?.includes('rate limit') || error.status === 429) {
              handleRateLimit(30);
            } else {
              console.error('Error fetching manufacturer data:', error);
            }
          });
        }, 200);
      }
    } catch (error: any) {
      if (error.message?.includes('rate limit') || error.status === 429) {
        handleRateLimit(30);
      } else {
        console.error('Error scheduling manufacturer data fetch:', error);
      }
    }
  };

  const fetchAircraftByRegionAndManufacturer = async (
    region: RegionCode,
    manufacturer: string,
    page: number = 1,
    limit: number = 500
  ) => {
    if (!region || !manufacturer) {
      console.log('Both region and manufacturer must be selected');
      return;
    }

    setLocalLoading(true);

    try {
      const response = await fetch(
        `/api/tracking/filtered-aircraft?region=${region}&manufacturer=${encodeURIComponent(manufacturer)}&page=${page}&limit=${limit}`
      );

      const data = await response.json();
      const aircraftData = data.aircraft || [];

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      // Process the filtered aircraft data
      if (aircraftData.length > 0) {
        // Transform to ExtendedAircraft
        interface AircraftData {
          TYPE_AIRCRAFT?: string;
          OPERATOR?: string;
          REGION: number;
        }

        const extendedAircraft: ExtendedAircraft[] = aircraftData.map(
          (aircraft: AircraftData) => ({
            ...aircraft,
            type: aircraft.TYPE_AIRCRAFT || 'Unknown',
            isGovernment:
              aircraft.OPERATOR?.toLowerCase().includes('government') ?? false,
            REGION: aircraft.REGION,
            zoomLevel: undefined,
          })
        );

        // Update the map
        updateGeofenceAircraft(extendedAircraft);
      } else {
        console.log(
          `No aircraft found for manufacturer ${manufacturer} in region ${region}`
        );
      }
    } catch (error) {
      console.error('Error fetching filtered aircraft:', error);
    } finally {
      setLocalLoading(false);
    }
  };

  // Model selection methods
  const handleModelSelect = (value: string) => {
    selectModel(value === '' ? null : value);
    setActiveDropdown(null);

    // If in combined mode, reapply the filter
    if (filterMode === 'both' && isGeofenceActive && selectedManufacturer) {
      setTimeout(() => {
        applyCombinedFilters();
      }, 100);
    }
  };

  // Combined filter methods
  const applyCombinedFilters = () => {
    if (
      !selectedManufacturer ||
      !isGeofenceActive ||
      geofenceAircraft.length === 0
    ) {
      return;
    }

    setLocalLoading(true);

    try {
      console.log(
        `Filtering ${geofenceAircraft.length} aircraft by ${selectedManufacturer}`
      );

      // Filter the aircraft by manufacturer
      let filteredAircraft = geofenceAircraft.filter(
        (aircraft) =>
          aircraft.MANUFACTURER?.toLowerCase() ===
          selectedManufacturer.toLowerCase()
      );

      // Further filter by model if selected
      if (selectedModel) {
        filteredAircraft = filteredAircraft.filter(
          (aircraft) =>
            aircraft.MODEL?.toLowerCase() === selectedModel.toLowerCase()
        );
      }

      console.log(`Found ${filteredAircraft.length} matching aircraft`);

      if (filteredAircraft.length === 0) {
        alert(`No ${selectedManufacturer} aircraft found in this area.`);
        return;
      }

      // Clear display data
      if (clearGeofenceData) {
        clearGeofenceData();
      }

      // Update the display
      updateGeofenceAircraft(filteredAircraft);
    } catch (error) {
      console.error('Error filtering aircraft:', error);
    } finally {
      setLocalLoading(false);
    }
  };

  // Reset all filters
  const clearAllFilters = () => {
    console.log('Clearing all filters...');

    // 1. Reset filter mode
    setFilterMode('manufacturer');

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

    // 5. Reset owner filters to select all
    setOwnerFilters([...allOwnerTypes]);

    // 6. Clear region filter properly
    setActiveRegion(null);
    setSelectedRegion(RegionCode.GLOBAL);

    // Clear region outline from map
    if (regionOutline) {
      try {
        // Handle different possible object structures
        if (typeof regionOutline.remove === 'function') {
          regionOutline.remove();
        } else if (
          regionOutline.rectangle &&
          typeof regionOutline.rectangle.remove === 'function'
        ) {
          regionOutline.rectangle.remove();
        }

        // Clear any labels associated with the region
        if (
          regionOutline.label &&
          typeof regionOutline.label.remove === 'function'
        ) {
          regionOutline.label.remove();
        }
      } catch (error) {
        console.error('Error removing region outline:', error);
      }

      // Always reset the region outline state
      setRegionOutline(null);
    }

    // 7. Reset map view to global
    if (mapInstance) {
      // Use the predefined center and zoom level from your map config
      mapInstance.setView(MAP_CONFIG.CENTER, MAP_CONFIG.DEFAULT_ZOOM);
      mapInstance.invalidateSize();
    }

    // 8. Reset to initial aircraft data
    if (typeof reset === 'function') {
      reset();
    } else if (typeof fullRefresh === 'function') {
      fullRefresh();
    }

    // 9. Close any open dropdown
    setActiveDropdown(null);

    // 10. Reset rate limiting states
    setIsRateLimited(false);
    setRateLimitTimer(null);

    // 11. Clear combined mode state
    setCombinedModeReady(false);

    // 12. Reset search terms
    setManufacturerSearchTerm('');

    // 13. Dispatch a custom event that other components can listen for
    const clearEvent = new CustomEvent('ribbon-filters-cleared');
    document.dispatchEvent(clearEvent);

    console.log('All filters cleared successfully');
  };

  // Calculate combined loading state
  const combinedLoading = localLoading;

  return {
    // State
    filterMode,
    activeDropdown,
    selectedManufacturer,
    selectedModel,
    geofenceLocation,
    geofenceRadius,
    isGeofenceActive,
    geofenceCoordinates,
    activeRegion,
    ownerFilters,
    allOwnerTypes,
    manufacturerSearchTerm,
    combinedLoading,
    isGettingLocation,
    dropdownRefs,
    localLoading,
    isRateLimited,
    selectedRegion,
    isRefreshing,

    // Methods
    toggleDropdown,
    toggleFilterMode,
    selectManufacturerAndClose,
    handleModelSelect,
    getUserLocation,
    processGeofenceSearch,
    handleOwnerFilterChange,
    handleRegionSelect,
    setManufacturerSearchTerm,
    setGeofenceLocation,
    setGeofenceRadius,
    toggleGeofenceState,
    clearAllFilters,
    applyCombinedFilters,
    getAircraftOwnerType,
  };
}
