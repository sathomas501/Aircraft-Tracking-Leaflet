import React, { useState, useEffect, useRef } from 'react';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import type { SelectOption } from '@/types/base';
import type { ExtendedAircraft } from '../../../types/base';
import type { AircraftModel } from '../../../types/aircraft-models';
import { adaptGeofenceAircraft } from '../../../lib/utils/geofenceAdapter';
import {
  getAircraftNearLocation,
  calculateDistance,
  searchLocationWithMapbox,
  getAircraftNearSearchedLocation,
} from '../../../lib/services/geofencing';
import { enrichGeofenceAircraft } from '../../../lib/utils/geofenceEnricher';
import { useGeolocation } from '../hooks/useGeolocation';
import openSkyTrackingService from '@/lib/services/openSkyTrackingService';
import OwnershipTypeFilter from '../map/components/OwnershipTypeFilter';
import { MAP_CONFIG, getBoundsByRegion } from '../../../config/map';

interface RibbonAircraftSelectorProps {
  manufacturers: SelectOption[];
}

// Fix the component declaration to explicitly return JSX.Element
const RibbonAircraftSelector: React.FC<RibbonAircraftSelectorProps> = ({
  manufacturers,
}) => {
  // Context state
  const {
    selectedManufacturer,
    selectedModel,
    activeModels,
    isLoading,
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

  // Local state for geofence loading
  const [localLoading, setLocalLoading] = useState(false);
  const combinedLoading = isLoading || localLoading;

  // Local state
  const [filterMode, setFilterMode] = useState<
    'manufacturer' | 'geofence' | 'both' | 'owner' | 'region'
  >('manufacturer');

  // Dropdown state
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Search term states
  const [manufacturerSearchTerm, setManufacturerSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Add state for API rate limiting
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
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const [isGeofenceActive, setIsGeofenceActive] = useState(false);
  const [combinedModeReady, setCombinedModeReady] = useState<boolean>(false);
  const [regionOutline, setRegionOutline] = useState<any>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>(
    MAP_CONFIG.REGIONS.GLOBAL
  );

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

  // Owner filter state with all owner types initially selected
  const [ownerFilters, setOwnerFilters] = useState<string[]>([
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
  ]);

  // All available owner types - used for select/clear all functionality
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

  // Initialize the geolocation hook
  const { getCurrentPosition } = useGeolocation();

  // Effect to handle rate limit recovery
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

  // Toggle dropdown menus
  // Add this to prevent event propagation in your click handlers
  const toggleDropdown = (dropdown: string, event: React.MouseEvent) => {
    if (activeDropdown === dropdown) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown(dropdown);
    }
    // Prevent events from bubbling up
    event.stopPropagation();
  };

  // Function to handle API rate limit errors
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

  // Owner filter handlers
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

  // Reset owner filters to select all
  const resetOwnerFilters = () => {
    setOwnerFilters([...allOwnerTypes]);
  };

  // Define these helper functions
  const getAircraftOwnerType = (aircraft: ExtendedAircraft): string => {
    const ownerType = aircraft.TYPE_REGISTRANT || 0;
    return ownerTypeToString(ownerType);
  };

  // Helper function to convert numeric owner types to strings
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

  // Function to handle region selection
  const handleRegionSelect = (region: string) => {
    setActiveRegion(region);
    setSelectedRegion(region);

    // Set map bounds based on region
    if (mapInstance) {
      const bounds = getBoundsByRegion(region);
      mapInstance.fitBounds(bounds as any);

      // Draw the region outline
      drawRegionOutline(region);
    }

    // Apply regional bounds to the current active filter
    applyRegionalBoundsToActiveFilter();

    // If we have aircraft data, filter it to the selected region
    if (displayedAircraft && displayedAircraft.length > 0) {
      filterAircraftByRegion(region);
    }

    // Close the dropdown after selection
    setActiveDropdown(null);
  };

  // Create function to draw the region outline
  const drawRegionOutline = (region: string) => {
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

  // Function to apply regional context to active filter
  const applyRegionalBoundsToActiveFilter = () => {
    if (!activeRegion) return;

    // Get the bounds for the selected region
    const bounds = getBoundsByRegion(activeRegion);
    if (!bounds) {
      console.error(`No bounds found for region: ${activeRegion}`);
      return;
    }

    // Apply region bounds to current filter mode logic
    switch (filterMode) {
      case 'manufacturer':
        // Filter by manufacturer AND region bounds
        filterAircraftByRegion(activeRegion);
        // Then apply manufacturer filter to the already region-filtered data
        break;
      case 'geofence':
        // Just use the region as the geofence
        filterAircraftByRegion(activeRegion);
        break;
      case 'both':
        // Apply both manufacturer and region filters
        filterAircraftByRegion(activeRegion);
        // Then apply manufacturer filter
        break;
      case 'owner':
        // Filter by owner type AND region bounds
        filterAircraftByRegion(activeRegion);
        // Then apply owner filter
        break;
      default:
        // Default just apply region filter
        filterAircraftByRegion(activeRegion);
    }
  };

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

  // Clear function to remove the region outline
  const clearRegionFilter = () => {
    // Clear region state
    setActiveRegion(null);

    // Clear region outline
    if (regionOutline) {
      try {
        // Make the removal more robust
        if (typeof regionOutline.remove === 'function') {
          regionOutline.remove();
        } else if (
          regionOutline.rectangle &&
          typeof regionOutline.rectangle.remove === 'function'
        ) {
          regionOutline.rectangle.remove();
        }

        // Clear any labels associated with the region if they exist
        if (
          regionOutline.label &&
          typeof regionOutline.label.remove === 'function'
        ) {
          regionOutline.label.remove();
        }
      } catch (error) {
        console.error('Error removing region outline:', error);
      }

      // Reset the regionOutline state
      setRegionOutline(null);
    }

    // Reset map view to global
    if (mapInstance) {
      try {
        const globalBounds = getBoundsByRegion(MAP_CONFIG.REGIONS.GLOBAL);
        mapInstance.fitBounds(globalBounds as any);
        mapInstance.invalidateSize(); // Force a map refresh
      } catch (error) {
        console.error('Error resetting map view:', error);
      }
    }
  };

  // Filter manufacturers by search term
  const filteredManufacturers = manufacturers.filter((manufacturer) =>
    manufacturer.label
      .toLowerCase()
      .includes(manufacturerSearchTerm.toLowerCase())
  );

  /**
   * Add a debounced/delayed version of the manufacturer data fetching function
   * to prevent overloading the API
   */
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

  // Function to get user's current location with rate limit handling
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
        setGeofenceCenter({ lat: latitude, lng: longitude });

        // Update state with coordinates
        setGeofenceCoordinates({ lat: latitude, lng: longitude });

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

          // Center the map on user's location
          if (mapInstance) {
            const radiusInDegrees = geofenceRadius / 111;
            const bounds = [
              [latitude - radiusInDegrees, longitude - radiusInDegrees],
              [latitude + radiusInDegrees, longitude + radiusInDegrees],
            ];

            mapInstance.setView([latitude, longitude], 9);
            setTimeout(() => {
              mapInstance.fitBounds(bounds as any);
              mapInstance.invalidateSize();
            }, 200);
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

  /**
   * Process geofence search with rate limit handling
   */
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

        // Center the map
        if (mapInstance && coordinates) {
          const radiusInDegrees = geofenceRadius / 111;
          const bounds = [
            [
              coordinates.lat - radiusInDegrees,
              coordinates.lng - radiusInDegrees,
            ],
            [
              coordinates.lat + radiusInDegrees,
              coordinates.lng + radiusInDegrees,
            ],
          ];

          mapInstance.setView([coordinates.lat, coordinates.lng], 9);
          setTimeout(() => {
            mapInstance.fitBounds(bounds as any);
            mapInstance.invalidateSize();
          }, 200);
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

  // Clear all filters
  const clearAllFilters = () => {
    // Unblock API calls
    openSkyTrackingService.setBlockAllApiCalls(false);
    setBlockManufacturerApiCalls(false);

    // Clear manufacturer selection
    selectManufacturer(null);
    selectModel(null);

    // Clear geofence
    setGeofenceLocation('');
    setGeofenceCoordinates(null);
    setGeofenceAircraft([]);
    setIsGeofenceActive(false);
    clearGeofenceData?.();

    // Reset owner filters back to all selected
    resetOwnerFilters();

    // Clear region filter
    clearRegionFilter();

    // Reset filter mode
    setFilterMode('manufacturer');

    // Close dropdown
    setActiveDropdown(null);
  };

  /**
   * Apply the combined filter for both manufacturer and geofence
   */
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
      clearGeofenceData?.();

      // Update the display
      updateGeofenceAircraft(filteredAircraft);
    } catch (error) {
      console.error('Error filtering aircraft:', error);
    } finally {
      setLocalLoading(false);
    }
  };

  /**
   * Toggle filter mode
   */
  const toggleFilterMode = (
    mode: 'manufacturer' | 'geofence' | 'both' | 'owner' | 'region'
  ) => {
    setFilterMode(mode);
    setActiveDropdown(null);

    // Apply appropriate filters based on new mode
    if (mode === 'region') {
      // Block API calls in region mode
      openSkyTrackingService.setBlockAllApiCalls(true);

      // Apply region filtering if we already have data
      if (displayedAircraft && displayedAircraft.length > 0) {
        filterAircraftByRegion(selectedRegion);
      } else if (mapInstance) {
        // Focus the map on the region if no data yet
        const bounds = getBoundsByRegion(selectedRegion);
        mapInstance.fitBounds(bounds as any);
        mapInstance.invalidateSize();
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

  /**
   * Toggle geofence state
   */
  const toggleGeofenceState = (enabled: boolean) => {
    setGeofenceEnabled(enabled);

    if (enabled) {
      // Enable geofence if we have coordinates
      if (geofenceCoordinates) {
        setIsGeofenceActive(true);
        toggleGeofence(); // Call the context function

        // Display aircraft if we have them
        if (geofenceAircraft.length > 0) {
          updateGeofenceAircraft(geofenceAircraft);
        }
      } else {
        // If no coordinates yet, prompt user to set location
        alert('Please set a location before enabling geofence');
        setGeofenceEnabled(false);
      }
    } else {
      // Disable geofence but keep the data
      setIsGeofenceActive(false);
      if (clearGeofenceData) {
        clearGeofenceData();
      }
    }
  };

  /**
   * Select manufacturer and handle associated actions
   */
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

    // Handle different filter modes
    if (filterMode === 'both') {
      // Keep API calls blocked in combined mode
      openSkyTrackingService.setBlockAllApiCalls(true);

      // If we have geofence data, apply the combined filter
      if (isGeofenceActive && geofenceAircraft.length > 0) {
        setTimeout(() => {
          applyCombinedFilters();
        }, 100);
      }
    } else if (filterMode === 'geofence' && value !== '') {
      // Switching from geofence to combined mode
      setFilterMode('both');
      openSkyTrackingService.setBlockAllApiCalls(true);

      if (isGeofenceActive && geofenceAircraft.length > 0) {
        setTimeout(() => {
          applyCombinedFilters();
        }, 100);
      }
    } else {
      // Pure manufacturer mode - allow API calls
      openSkyTrackingService.setBlockAllApiCalls(false);
      fetchManufacturerData(value);
    }
  };

  /**
   * Handle model selection
   */
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

  /**
   * Handle data refresh
   */
  const handleManualRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    setActiveDropdown(null);

    try {
      if (filterMode === 'both' && isGeofenceActive && selectedManufacturer) {
        // In combined mode, only refresh the geofence, then filter
        if (geofenceCoordinates) {
          const refreshedAircraft = await getAircraftNearLocation(
            geofenceCoordinates.lat,
            geofenceCoordinates.lng,
            geofenceRadius
          );

          if (refreshedAircraft.length > 0) {
            const adaptedAircraft = adaptGeofenceAircraft(refreshedAircraft);
            const enrichedAircraft =
              await enrichGeofenceAircraft(adaptedAircraft);

            // Store the full set
            setGeofenceAircraft(enrichedAircraft);

            // Apply the filtering
            setTimeout(() => {
              applyCombinedFilters();
            }, 100);
          }
        }
      } else if (filterMode === 'geofence' && isGeofenceActive) {
        // Pure geofence refresh
        if (geofenceCoordinates) {
          const refreshedAircraft = await getAircraftNearLocation(
            geofenceCoordinates.lat,
            geofenceCoordinates.lng,
            geofenceRadius
          );

          if (refreshedAircraft.length > 0) {
            const adaptedAircraft = adaptGeofenceAircraft(refreshedAircraft);
            const enrichedAircraft =
              await enrichGeofenceAircraft(adaptedAircraft);

            setGeofenceAircraft(enrichedAircraft);
            updateGeofenceAircraft(enrichedAircraft);
          }
        }
      } else if (filterMode === 'manufacturer' && selectedManufacturer) {
        // Manufacturer-only refresh
        await refreshPositions();
      } else if (filterMode === 'owner') {
        // Refresh and reapply owner filters
        toggleFilterMode('owner');
      } else if (filterMode === 'region' && selectedRegion) {
        // Refresh region filter
        handleRegionSelect(selectedRegion);
      }
    } catch (error) {
      console.error('Error refreshing aircraft data:', error);
      alert('Failed to refresh aircraft data. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Group models by their first letter for the dropdown
  const groupModelsByLetter = () => {
    const groups: Record<string, AircraftModel[]> = {};

    activeModels.forEach((model) => {
      const firstChar = model.MODEL.charAt(0).toUpperCase();
      if (!groups[firstChar]) {
        groups[firstChar] = [];
      }
      groups[firstChar].push(model);
    });

    // Sort each group alphabetically
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => a.MODEL.localeCompare(b.MODEL));
    });

    return groups;
  };

  // Get most popular models for quick selection
  const getPopularModels = () => {
    return [...activeModels].sort((a, b) => b.count - a.count).slice(0, 8);
  };

  // RENDERING COMPONENTS

  // Render Filter Mode Dropdown
  const renderFilterModeDropdown = () => (
    <div ref={dropdownRefs.filter} className="relative">
      <button
        className={`px-4 py-2 flex items-center justify-between gap-2 ${
          activeDropdown === 'filter'
            ? 'bg-indigo-100 text-indigo-700'
            : 'hover:bg-gray-100'
        }`}
        onClick={(event) => toggleDropdown('filter', event)}
      >
        <span className="flex items-center gap-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          {filterMode === 'manufacturer'
            ? 'Manufacturer'
            : filterMode === 'geofence'
              ? 'Location'
              : filterMode === 'both'
                ? 'Combined'
                : filterMode === 'owner'
                  ? 'Owner Type'
                  : 'Region'}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 transition-transform ${activeDropdown === 'filter' ? 'transform rotate-180' : ''}`}
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

      {activeDropdown === 'filter' && (
        <div className="absolute left-0 top-full mt-1 w-48 bg-white shadow-lg rounded-md border border-gray-200 z-50">
          <div
            className={`px-4 py-2 hover:bg-indigo-50 cursor-pointer ${filterMode === 'manufacturer' ? 'bg-indigo-50 text-indigo-700 font-medium' : ''}`}
            onClick={() => toggleFilterMode('manufacturer')}
          >
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              Manufacturer
            </div>
          </div>

          <div
            className={`px-4 py-2 hover:bg-indigo-50 cursor-pointer ${filterMode === 'geofence' ? 'bg-indigo-50 text-indigo-700 font-medium' : ''}`}
            onClick={() => toggleFilterMode('geofence')}
          >
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
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
              Location
            </div>
          </div>

          <div
            className={`px-4 py-2 hover:bg-indigo-50 cursor-pointer ${filterMode === 'region' ? 'bg-indigo-50 text-indigo-700 font-medium' : ''}`}
            onClick={() => toggleFilterMode('region')}
          >
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Region
            </div>
          </div>

          <div
            className={`px-4 py-2 hover:bg-indigo-50 cursor-pointer ${filterMode === 'owner' ? 'bg-indigo-50 text-indigo-700 font-medium' : ''}`}
            onClick={() => toggleFilterMode('owner')}
          >
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              Owner Type
            </div>
          </div>

          <div
            className={`px-4 py-2 hover:bg-indigo-50 cursor-pointer ${filterMode === 'both' ? 'bg-indigo-50 text-indigo-700 font-medium' : ''}`}
            onClick={() => toggleFilterMode('both')}
          >
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Combined
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Render Manufacturer Dropdown
  const renderManufacturerDropdown = () => (
    <div ref={dropdownRefs.manufacturer} className="relative">
      <button
        className={`px-4 py-2 flex items-center justify-between gap-2 ${
          activeDropdown === 'manufacturer'
            ? 'bg-indigo-100 text-indigo-700'
            : selectedManufacturer
              ? 'bg-indigo-50 text-indigo-600'
              : 'hover:bg-gray-100'
        }`}
        onClick={(event) => toggleDropdown('manufacturer', event)}
      >
        <span className="flex items-center gap-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          {selectedManufacturer
            ? manufacturers.find((m) => m.value === selectedManufacturer)
                ?.label || selectedManufacturer
            : 'Manufacturer'}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 transition-transform ${activeDropdown === 'manufacturer' ? 'transform rotate-180' : ''}`}
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

      {activeDropdown === 'manufacturer' && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white shadow-lg rounded-md border border-gray-200 z-50">
          <div className="sticky top-0 bg-white p-2 border-b">
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Search manufacturers..."
              value={manufacturerSearchTerm}
              onChange={(e) => setManufacturerSearchTerm(e.target.value)}
              autoFocus
            />

            {selectedManufacturer && (
              <button
                onClick={() => selectManufacturerAndClose('')}
                className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
              >
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {filteredManufacturers.length === 0 ? (
              <div className="p-3 text-center text-gray-500">
                No results found
              </div>
            ) : (
              filteredManufacturers.map((manufacturer) => (
                <div
                  key={manufacturer.value}
                  className={`px-3 py-2 hover:bg-indigo-50 cursor-pointer ${
                    selectedManufacturer === manufacturer.value
                      ? 'bg-indigo-50 font-medium text-indigo-700'
                      : 'text-gray-700'
                  }`}
                  onClick={() => selectManufacturerAndClose(manufacturer.value)}
                >
                  {manufacturer.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );

  // Render Model Dropdown - only enabled if manufacturer is selected
  const renderModelDropdown = () => {
    const isEnabled = !!selectedManufacturer;
    const groupedModels = isEnabled ? groupModelsByLetter() : {};
    const popularModels = isEnabled ? getPopularModels() : [];

    return (
      <div ref={dropdownRefs.model} className="relative">
        <button
          className={`px-4 py-2 flex items-center justify-between gap-2 ${
            !isEnabled
              ? 'opacity-50 cursor-not-allowed'
              : activeDropdown === 'model'
                ? 'bg-indigo-100 text-indigo-700'
                : selectedModel
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'hover:bg-gray-100'
          }`}
          onClick={(event) => isEnabled && toggleDropdown('model', event)}
          disabled={!isEnabled}
        >
          <span className="flex items-center gap-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
            {selectedModel || `Model ${isEnabled ? `(${totalActive})` : ''}`}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 transition-transform ${activeDropdown === 'model' ? 'transform rotate-180' : ''}`}
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

        {isEnabled && activeDropdown === 'model' && (
          <div className="absolute left-0 top-full mt-1 w-64 bg-white shadow-lg rounded-md border border-gray-200 z-50">
            <div className="sticky top-0 bg-white border-b">
              <div
                className="px-3 py-2 hover:bg-indigo-50 cursor-pointer font-medium"
                onClick={() => handleModelSelect('')}
              >
                All Models ({totalActive})
                {selectedModel && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleModelSelect('');
                    }}
                    className="float-right text-gray-400 hover:text-gray-600"
                  >
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Popular models section */}
            {popularModels.length > 0 && (
              <div>
                <div className="px-3 py-1 text-xs text-gray-500 bg-gray-50">
                  Popular Models
                </div>
                <div className="p-2 flex flex-wrap gap-1">
                  {popularModels.map((model) => (
                    <div
                      key={model.MODEL}
                      className={`px-2 py-1 rounded-full text-xs cursor-pointer ${
                        selectedModel === model.MODEL
                          ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                          : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                      }`}
                      onClick={() => handleModelSelect(model.MODEL)}
                    >
                      {model.MODEL} ({model.count})
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alphabetical model listing */}
            <div className="max-h-72 overflow-y-auto">
              {Object.keys(groupedModels)
                .sort()
                .map((letter) => (
                  <div key={letter}>
                    <div className="px-3 py-1 text-xs text-gray-500 bg-gray-50 sticky top-0 z-10">
                      {letter}
                    </div>
                    {groupedModels[letter].map((model) => (
                      <div
                        key={model.MODEL}
                        className={`px-3 py-2 hover:bg-indigo-50 cursor-pointer flex justify-between ${
                          selectedModel === model.MODEL
                            ? 'bg-indigo-50 font-medium text-indigo-700'
                            : 'text-gray-700'
                        }`}
                        onClick={() => handleModelSelect(model.MODEL)}
                      >
                        <span>{model.MODEL}</span>
                        <span className="text-gray-500 text-sm">
                          {model.count}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render Location/Geofence Dropdown
  const renderLocationDropdown = () => (
    <div ref={dropdownRefs.location} className="relative">
      <button
        className={`px-4 py-2 flex items-center justify-between gap-2 ${
          activeDropdown === 'location'
            ? 'bg-indigo-100 text-indigo-700'
            : isGeofenceActive
              ? 'bg-indigo-50 text-indigo-600'
              : 'hover:bg-gray-100'
        }`}
        onClick={(event) => toggleDropdown('location', event)}
      >
        <span className="flex items-center gap-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
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
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
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
              onClick={() => toggleGeofenceState(!geofenceEnabled)}
            >
              {isGeofenceActive ? 'Geofence Active' : 'Enable Geofence'}
            </button>

            {isGeofenceActive && (
              <button
                onClick={() => {
                  clearGeofence();
                  setGeofenceLocation('');
                  setGeofenceCoordinates(null);
                  setGeofenceAircraft([]);
                  setIsGeofenceActive(false);
                  clearGeofenceData?.();
                  setActiveDropdown(null);
                }}
                className="ml-2 px-3 py-2 border border-red-200 text-red-600 rounded-md text-sm font-medium hover:bg-red-50"
              >
                Clear
              </button>
            )}
          </div>

          {isGeofenceActive && geofenceAircraft.length > 0 && (
            <div className="p-3 bg-gray-50 text-xs text-gray-600 border-t">
              <div className="font-medium text-indigo-700 mb-1">
                {geofenceAircraft.length} aircraft found
              </div>
              {geofenceCoordinates && (
                <>
                  <div>
                    Coordinates: {geofenceCoordinates.lat.toFixed(4)},{' '}
                    {geofenceCoordinates.lng.toFixed(4)}
                  </div>
                  <div>Radius: {geofenceRadius} km</div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Render Region Dropdown
  const renderRegionDropdown = () => (
    <div ref={dropdownRefs.region} className="relative">
      <button
        className={`px-4 py-2 flex items-center justify-between gap-2 ${
          activeDropdown === 'region'
            ? 'bg-indigo-100 text-indigo-700'
            : activeRegion
              ? 'bg-indigo-50 text-indigo-600'
              : 'hover:bg-gray-100'
        }`}
        onClick={(event) => toggleDropdown('region', event)}
      >
        <span className="flex items-center gap-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {activeRegion || 'Region'}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 transition-transform ${activeDropdown === 'region' ? 'transform rotate-180' : ''}`}
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

      {activeDropdown === 'region' && (
        <div className="absolute left-0 top-full mt-1 w-52 bg-white shadow-lg rounded-md border border-gray-200 z-50">
          <div className="p-3 grid grid-cols-1 gap-2">
            {Object.values(MAP_CONFIG.REGIONS).map((region) => (
              <button
                key={region}
                onClick={() => handleRegionSelect(region)}
                className={`px-3 py-2 text-sm rounded-md ${
                  selectedRegion === region
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                    : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {region}
              </button>
            ))}
          </div>

          {activeRegion && (
            <div className="p-3 border-t flex justify-end">
              <button
                onClick={clearRegionFilter}
                className="px-3 py-1 border border-red-200 text-red-600 rounded-md text-sm font-medium hover:bg-red-50"
              >
                Clear Region
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Render Owner Type Dropdown
  const renderOwnerDropdown = () => (
    <div ref={dropdownRefs.owner} className="relative">
      <button
        className={`px-4 py-2 flex items-center justify-between gap-2 ${
          activeDropdown === 'owner'
            ? 'bg-indigo-100 text-indigo-700'
            : ownerFilters.length < allOwnerTypes.length
              ? 'bg-indigo-50 text-indigo-600'
              : 'hover:bg-gray-100'
        }`}
        onClick={(event) => toggleDropdown('owner', event)}
      >
        <span className="flex items-center gap-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          {ownerFilters.length === allOwnerTypes.length
            ? 'Owner Types'
            : `Owner Types (${ownerFilters.length})`}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 transition-transform ${activeDropdown === 'owner' ? 'transform rotate-180' : ''}`}
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

      {activeDropdown === 'owner' && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white shadow-lg rounded-md border border-gray-200 z-50">
          <div className="p-3 border-b flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">
              Owner Type Filters
            </span>
            <div className="space-x-2">
              <button
                onClick={() => setOwnerFilters([...allOwnerTypes])}
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                Select All
              </button>
              <button
                onClick={() => setOwnerFilters([])}
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-3">
            <OwnershipTypeFilter
              onFilterChange={handleOwnerFilterChange}
              activeFilters={ownerFilters}
            />
          </div>

          <div className="p-3 border-t flex justify-between items-center">
            <span className="text-xs text-gray-500">
              {ownerFilters.length} of {allOwnerTypes.length} selected
            </span>
            <button
              onClick={() => {
                toggleFilterMode('owner');
                setActiveDropdown(null);
              }}
              className="px-3 py-1 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Render Actions Dropdown
  const renderActionsDropdown = () => (
    <div ref={dropdownRefs.actions} className="relative">
      <button
        className={`px-4 py-2 flex items-center justify-between gap-2 ${
          activeDropdown === 'actions'
            ? 'bg-indigo-100 text-indigo-700'
            : 'hover:bg-gray-100'
        }`}
        onClick={(event) => toggleDropdown('actions', event)}
      >
        <span className="flex items-center gap-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          Actions
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 transition-transform ${activeDropdown === 'actions' ? 'transform rotate-180' : ''}`}
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

      {activeDropdown === 'actions' && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white shadow-lg rounded-md border border-gray-200 z-50">
          <button
            onClick={handleManualRefresh}
            className={`w-full px-4 py-2 text-left hover:bg-indigo-50 flex items-center gap-2 ${
              isRefreshing ? 'bg-gray-400 cursor-not-allowed' : ''
            }`}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
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
                Refreshing...
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh Data
              </>
            )}
          </button>

          <button
            onClick={clearAllFilters}
            className="w-full px-4 py-2 text-left hover:bg-indigo-50 flex items-center gap-2 border-t"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Clear All Filters
          </button>
        </div>
      )}
    </div>
  );

  // Render Aircraft Stats
  const renderAircraftStats = () => {
    let count = 0;
    let statusText = '';

    if (filterMode === 'geofence' || filterMode === 'both') {
      count = geofenceAircraft.length;
      statusText = 'Aircraft in location';
    } else if (filterMode === 'owner' || filterMode === 'region') {
      count = displayedAircraft?.length || 0;
      statusText =
        filterMode === 'owner' ? 'Aircraft by owner' : 'Aircraft in region';
    } else {
      count = totalActive;
      statusText = 'Active aircraft';
    }

    return (
      <div className="flex items-center gap-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm border-l">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-indigo-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>
          <span className="font-medium text-indigo-600">{count}</span>{' '}
          {statusText}
        </span>

        {combinedLoading && (
          <svg
            className="animate-spin ml-2 h-4 w-4 text-indigo-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
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
        )}
      </div>
    );
  };

  // Main render method
  return (
    <div className="w-full sticky top-0 z-[100] bg-white overflow-visible">
      {/* Main ribbon containing all controls */}
      <div className="flex items-center h-12">
        {/* Logo / Title */}
        <div className="bg-indigo-600 text-white h-full flex items-center px-4 font-semibold">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-2"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
          Aircraft Finder
        </div>

        {/* Filter Mode Dropdown */}
        {renderFilterModeDropdown()}

        {/* Divider */}
        <div className="h-6 w-px bg-gray-300 mx-1"></div>

        {/* Manufacturer Dropdown */}
        {renderManufacturerDropdown()}

        {/* Model Dropdown */}
        {renderModelDropdown()}

        {/* Divider */}
        <div className="h-6 w-px bg-gray-300 mx-1"></div>

        {/* Location Dropdown */}
        {renderLocationDropdown()}

        {/* Region Dropdown */}
        {renderRegionDropdown()}

        {/* Owner Type Dropdown */}
        {renderOwnerDropdown()}

        {/* Spacer */}
        <div className="flex-grow"></div>

        {/* Aircraft Stats Display */}
        {renderAircraftStats()}

        {/* Actions Dropdown */}
        {renderActionsDropdown()}
      </div>
    </div>
  );
};

export default RibbonAircraftSelector;
