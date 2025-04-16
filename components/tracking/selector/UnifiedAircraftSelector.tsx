//##############part 1 imports and the component setup with state declarations
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

interface UnifiedAircraftSelectorProps {
  manufacturers: SelectOption[];
}

const UnifiedAircraftSelector: React.FC<UnifiedAircraftSelectorProps> = ({
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

  const [manufacturerSearchTerm, setManufacturerSearchTerm] = useState('');
  const [isManufacturerMenuOpen, setIsManufacturerMenuOpen] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectorMinimized, setSelectorMinimized] = useState(false);

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

  // State for active tab
  const [activeTab, setActiveTab] = useState('manufacturer');

  // Draggable state
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const manufacturerMenuRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  //####part 2 helper functions and event handlers

  // Add this function to your component
  const applyOwnerTypeFilter = (filters: string[]) => {
    // Skip filtering if all types are selected or none are selected
    if (filters.length === 0 || filters.length === allOwnerTypes.length) {
      // If no filters or all filters, show all aircraft
      // This depends on how you're managing your aircraft data
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

  // Function to pass to GeofenceControl
  const handleTabChange = (tabName: string): void => {
    setActiveTab(tabName);
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
  };

  // 3. Create function to draw the region outline
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
    const [[southWest_lat, southWest_lng], [northEast_lat, northEast_lng]] =
      bounds;

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

    // Store reference so we can remove it later
    setRegionOutline(rectangle);

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

    // Apply region bounds to current filter mode logic
    switch (filterMode) {
      case 'manufacturer':
        // Limit manufacturer filter to region
        break;
      case 'geofence':
        // Limit geofence to region
        break;
      case 'both':
        // Limit geofence to region
        break;
      case 'owner':
        // Limit geofence to region
        break;
      // etc.
    }
  };

  const filterAircraftByRegion = (region: string) => {
    if (!displayedAircraft || displayedAircraft.length === 0) return;

    setLocalLoading(true);

    try {
      // Get the bounds for the selected region
      const bounds = getBoundsByRegion(region);
      const [[minLat, minLng], [maxLat, maxLng]] = bounds as [
        [number, number],
        [number, number],
      ];

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
        `Filtered to ${filteredAircraft.length} aircraft in ${region} region`
      );
    } catch (error) {
      console.error('Error filtering aircraft by region:', error);
    } finally {
      setLocalLoading(false);
    }
  };

  // 5. Make sure to clear the outline when component unmounts or when region is cleared
  useEffect(() => {
    return () => {
      if (regionOutline) {
        regionOutline.remove();
      }
    };
  }, [regionOutline]);

  // 6. Add a clear function to remove the region outline
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

    // If you need to force a re-render, use a state update instead of forceUpdate
    // setRefreshCounter(prev => prev + 1);
  };

  // Filter manufacturers by search term
  const filteredManufacturers = manufacturers.filter((manufacturer) =>
    manufacturer.label
      .toLowerCase()
      .includes(manufacturerSearchTerm.toLowerCase())
  );

  // Dragging functionality
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: Math.max(0, e.clientX - dragOffset.x),
          y: Math.max(0, e.clientY - dragOffset.y),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'grabbing';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
  }, [isDragging, dragOffset]);

  // Initialize the geolocation hook
  const { getCurrentPosition } = useGeolocation();

  // Function to get user's current location
  const getUserLocation = async () => {
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
        const enrichedAircraft = await enrichGeofenceAircraft(adaptedAircraft);

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

  // Create an effect to sync the component state with the external geofence button
  useEffect(() => {
    // Update internal state when geofence is toggled externally
    if (isGeofenceActive !== geofenceEnabled) {
      setGeofenceEnabled(isGeofenceActive);
    }
  }, [isGeofenceActive]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        manufacturerMenuRef.current &&
        !manufacturerMenuRef.current.contains(event.target as Node) &&
        dropdownButtonRef.current &&
        !dropdownButtonRef.current.contains(event.target as Node)
      ) {
        setIsManufacturerMenuOpen(false);
      }

      if (
        modelMenuRef.current &&
        !modelMenuRef.current.contains(event.target as Node)
      ) {
        setIsModelMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Start dragging
  const startDragging = (e: React.MouseEvent) => {
    if (
      e.target === containerRef.current ||
      (e.target as HTMLElement).closest('.drag-handle')
    ) {
      e.preventDefault();
      setIsDragging(true);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    }
  };
  //#########part 3 core business logic functions like processGeofenceSearch and filter operations

  /**
   * Modified geofence search processor
   * Handles the case where we're in combined mode
   */
  const processGeofenceSearch = async () => {
    if (!geofenceLocation) return;

    // Block API calls while doing geofence search in combined mode
    if (filterMode === 'both') {
      openSkyTrackingService.setBlockAllApiCalls(true);
    }

    // Set loading state
    setLocalLoading(true);

    try {
      console.log(
        `Searching for aircraft near location: "${geofenceLocation}"`
      );

      // This will handle Postal codes, place names, addresses, POIs, etc.
      const fetchedAircraft = await getAircraftNearSearchedLocation(
        geofenceLocation,
        geofenceRadius
      );

      // Get coordinates for the map
      const locations = await searchLocationWithMapbox(geofenceLocation, 1);
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
      } else {
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

      // Debug the first aircraft
      if (enrichedAircraft.length > 0) {
        console.log('Enriched aircraft sample:', {
          icao24: enrichedAircraft[0].ICAO24,
          manufacturer: enrichedAircraft[0].MANUFACTURER,
          model: enrichedAircraft[0].MODEL,
        });
      }

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
    } catch (error) {
      console.error('Error in geofence search:', error);
      alert(
        `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
      );
    } finally {
      setLocalLoading(false);
    }
  };

  // Helper function to determine aircraft type
  const getAircraftType = (aircraft: any): string => {
    const typeFields = ['TYPE_AIRCRAFT', 'type_aircraft', 'model'];

    // Check for helicopter in any available type field
    for (const field of typeFields) {
      const value = aircraft[field];
      if (
        typeof value === 'string' &&
        value.toLowerCase().includes('helicopter')
      ) {
        return 'helicopter';
      }
    }

    // Default to plane
    return 'plane';
  };

  // Clear all filters
  const clearAllFilters = () => {
    // Unblock API calls
    openSkyTrackingService.setBlockAllApiCalls(false);
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

    // Reset filter mode
    setFilterMode('manufacturer');
  };

  /**
   * Apply the combined filter for both manufacturer and geofence
   * This implements a more efficient filtering approach by caching the full geofence results
   * and only applying manufacturer filtering in the UI
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
  //#part 4########################  more business logic and the beginning of rendering functions

  /**
   * Enhanced toggleFilterMode function
   * Ensures no searches start until both selection criteria are met
   */
  const toggleFilterMode = (
    mode: 'manufacturer' | 'geofence' | 'both' | 'owner' | 'region'
  ) => {
    setFilterMode(mode);

    // Apply appropriate filters based on new mode
    if (mode === 'manufacturer') {
      // Existing code...
    } else if (mode === 'geofence') {
      // Existing code...
    } else if (mode === 'owner') {
      // Existing code...
    } else if (mode === 'both') {
      // Existing code...
    } else if (mode === 'region') {
      // Block API calls in region mode
      openSkyTrackingService.setBlockAllApiCalls(true);

      // Apply region filtering if we already have data
      if (displayedAircraft && displayedAircraft.length > 0) {
        filterAircraftByRegion(selectedRegion);
      } else if (mapInstance) {
        // Just focus the map on the region if no data yet
        const bounds = getBoundsByRegion(selectedRegion);
        mapInstance.fitBounds(bounds as any);
        mapInstance.invalidateSize();
      }

      // Clear manufacturer selection from the UI but keep track of what was selected
      const prevManufacturer = selectedManufacturer;
      const prevModel = selectedModel;

      // Clear the manufacturer filter in the UI
      selectManufacturer(null);
      selectModel(null);

      // If geofence is active, restore the full geofence data
      if (geofenceCoordinates && geofenceAircraft.length > 0) {
        console.log('Restoring full geofence data');
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
        console.log('Both filters active, applying combined filter');
        applyCombinedFilters();
      } else {
        console.log('Need both manufacturer and geofence to use combined mode');
        // If one is missing, we can prompt the user
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

  // 3. Function to toggle geofence state (can be called from component or external button)
  const toggleGeofenceState = (enabled: boolean) => {
    setGeofenceEnabled(enabled);

    const handleExternalGeofenceToggle = (enabled: boolean) => {
      toggleGeofenceState(enabled);
    };

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

  // Function to toggle minimized state
  const toggleMinimized = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent dragging when clicking this button
    setSelectorMinimized(!selectorMinimized);
    console.log('Toggling minimized state:', !selectorMinimized); // Debug
  };

  // Group models alphabetically for the dropdown
  const groupedModels = activeModels.reduce(
    (groups: Record<string, AircraftModel[]>, model) => {
      const firstChar = model.MODEL.charAt(0).toUpperCase();
      if (!groups[firstChar]) {
        groups[firstChar] = [];
      }
      groups[firstChar].push(model);
      return groups;
    },
    {}
  );

  /**
   * Modified manufacturer selection handler
   * Prevents API calls in combined mode
   */
  const selectManufacturerAndClose = (value: string) => {
    // Close UI elements
    setIsManufacturerMenuOpen(false);
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
      // Add explicit data fetching for manufacturer-only mode
      // This is likely the missing trigger
      fetchManufacturerData(value);
    }
  };

  // Add this function to handle manufacturer-specific data fetching
  const fetchManufacturerData = (manufacturer: string) => {
    console.log(`Fetching data for manufacturer: ${manufacturer}`);

    // If you have a context function for this, call it directly
    if (typeof refreshPositions === 'function') {
      refreshPositions();
    }

    // Or if you need to make a direct API call
    // You might need to implement this based on your API structure
    // Example:
    // fetchAircraftByManufacturer(manufacturer)
    //   .then(data => updateAircraftData(data))
    //   .catch(error => console.error('Error fetching manufacturer data:', error));
  };

  /**
   * Handle model selection and filtering
   */
  const handleModelSelect = (value: string) => {
    selectModel(value === '' ? null : value);
    setIsModelMenuOpen(false);

    // If in combined mode, reapply the filter
    if (filterMode === 'both' && isGeofenceActive && selectedManufacturer) {
      setTimeout(() => {
        applyCombinedFilters();
      }, 100);
    }
  };

  /**
   * Enhanced handleManualRefresh function
   * Optimized to avoid unnecessary API calls
   */
  const handleManualRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);

    try {
      if (filterMode === 'both' && isGeofenceActive && selectedManufacturer) {
        // In combined mode, only refresh the geofence, then filter
        console.log('Refreshing geofence data in combined mode');

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

            console.log(
              `Successfully refreshed ${enrichedAircraft.length} geofence aircraft`
            );
          }
        }
      } else if (filterMode === 'geofence' && isGeofenceActive) {
        // Pure geofence refresh
        console.log('Refreshing geofence only');

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

            console.log(
              `Successfully refreshed ${enrichedAircraft.length} geofence aircraft`
            );
          }
        }
      } else if (filterMode === 'manufacturer' && selectedManufacturer) {
        // Manufacturer-only refresh
        console.log('Refreshing manufacturer aircraft data...');
        await refreshPositions();
      } else if (filterMode === 'owner') {
        // Refresh and reapply owner filters
        console.log('Refreshing and reapplying owner filters...');
        toggleFilterMode('owner');
      }
    } catch (error) {
      console.error('Error refreshing aircraft data:', error);
      alert('Failed to refresh aircraft data. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Sort models by popularity for quick selection
  const modelsByPopularity = [...activeModels]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // ============= RENDERING FUNCTIONS =============

  // Render header with minimize button
  const renderHeader = () => (
    <div
      className="bg-indigo-600 text-white px-4 py-3 flex justify-between items-center cursor-grab drag-handle"
      onMouseDown={startDragging}
    >
      <h2 className="font-semibold text-center flex-grow flex items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 mr-2"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
        </svg>
        Aircraft Finder
      </h2>

      <button
        onClick={toggleMinimized}
        className="text-white hover:bg-indigo-700 p-1 rounded focus:outline-none"
        title={selectorMinimized ? 'Expand' : 'Minimize'}
      >
        {selectorMinimized ? '▲' : '▼'}
      </button>
    </div>
  );

  //########################part5 all render and final return

  // Render owner type filter section
  const renderOwnerTypeFilter = () => (
    <div className="p-4 border-b border-gray-200">
      <div className="mb-2 flex justify-between items-center">
        <label className="text-sm font-medium text-gray-700">
          Owner Type Filters
        </label>
        <div className="space-x-2">
          <button
            onClick={() => setOwnerFilters([...allOwnerTypes])}
            className="text-xs text-indigo-600 hover:text-indigo-800"
          >
            Select All
          </button>
          <button
            onClick={() => {
              setOwnerFilters([]);
              clearRegionFilter(); // Call your existing region clearing function
            }}
            className="text-xs text-indigo-600 hover:text-indigo-800"
          >
            Clear All
          </button>
        </div>
      </div>

      <div className="max-h-52 overflow-y-auto pr-1">
        <OwnershipTypeFilter
          onFilterChange={handleOwnerFilterChange}
          activeFilters={ownerFilters}
        />
      </div>

      {/* Count of selected filters */}
      <div className="mt-2 text-xs text-gray-500">
        {ownerFilters.length} of {allOwnerTypes.length} owner types selected
      </div>

      {/* Apply button for owner filters */}
      <button
        onClick={() => toggleFilterMode('owner')}
        className="mt-2 w-full px-3 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700"
      >
        Apply Owner Filters
      </button>
    </div>
  );

  // 5. Update renderFilterToggle to match the tab interface in the screenshot
  const renderFilterToggle = () => (
    <div className="flex border-b bg-white">
      <button
        className={`flex-1 py-2 text-sm font-medium ${
          filterMode === 'manufacturer'
            ? 'text-indigo-600 border-b-2 border-indigo-500'
            : 'text-gray-500 hover:text-gray-700'
        }`}
        onClick={() => toggleFilterMode('manufacturer')}
      >
        Manufacturer
      </button>
      <button
        className={`flex-1 py-2 text-sm font-medium ${
          filterMode === 'geofence'
            ? 'text-indigo-600 border-b-2 border-indigo-500'
            : 'text-gray-500 hover:text-gray-700'
        }`}
        onClick={() => toggleFilterMode('geofence')}
      >
        Location
      </button>
      <button
        className={`flex-1 py-2 text-sm font-medium ${
          filterMode === 'region'
            ? 'text-indigo-600 border-b-2 border-indigo-500'
            : 'text-gray-500 hover:text-gray-700'
        }`}
        onClick={() => toggleFilterMode('region')}
      >
        Region
      </button>
      <button
        className={`flex-1 py-2 text-sm font-medium ${
          filterMode === 'both'
            ? 'text-indigo-600 border-b-2 border-indigo-500'
            : 'text-gray-500 hover:text-gray-700'
        }`}
        onClick={() => toggleFilterMode('both')}
      >
        Combined
      </button>
      <button
        className={`flex-1 py-2 text-sm font-medium ${
          filterMode === 'owner'
            ? 'text-indigo-600 border-b-2 border-indigo-500'
            : 'text-gray-500 hover:text-gray-700'
        }`}
        onClick={() => toggleFilterMode('owner')}
      >
        Owner
      </button>
    </div>
  );

  // Render manufacturer filter section
  const renderManufacturerFilter = () => (
    <div
      className={`mb-4 ${filterMode === 'both' ? 'pb-3 border-b border-gray-200' : ''}`}
    >
      <div className="mb-2 flex justify-between items-center">
        <label className="text-sm font-medium text-gray-700">
          Manufacturer
        </label>
        {selectedManufacturer && (
          <button
            onClick={() => selectManufacturer(null)}
            className="text-xs text-indigo-600 hover:text-indigo-800"
          >
            Clear
          </button>
        )}
      </div>

      {/* Manufacturer Dropdown */}
      <div className="relative" ref={manufacturerMenuRef}>
        <button
          ref={dropdownButtonRef}
          className={`w-full flex items-center justify-between px-3 py-2 border ${
            isManufacturerMenuOpen
              ? 'border-indigo-500 ring-1 ring-indigo-300'
              : 'border-gray-300 hover:border-gray-400'
          } rounded-md bg-white transition-colors`}
          onClick={() => setIsManufacturerMenuOpen(!isManufacturerMenuOpen)}
        >
          {selectedManufacturer ? (
            <span className="text-indigo-700 font-medium truncate">
              {manufacturers.find((m) => m.value === selectedManufacturer)
                ?.label || selectedManufacturer}
            </span>
          ) : (
            <span className="text-gray-500 truncate">
              Select manufacturer...
            </span>
          )}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 text-gray-500 transition-transform ${
              isManufacturerMenuOpen ? 'transform rotate-180' : ''
            }`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* Manufacturer Dropdown Menu */}
        {isManufacturerMenuOpen && (
          <div
            className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg"
            style={{ maxHeight: '300px', overflowY: 'auto' }}
          >
            <div className="sticky top-0 bg-white p-2 border-b">
              <input
                ref={searchInputRef}
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Search manufacturers..."
                value={manufacturerSearchTerm}
                onChange={(e) => setManufacturerSearchTerm(e.target.value)}
              />
            </div>

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
        )}
      </div>

      {/* Model Selection - Only show if manufacturer selected */}
      {renderModelSelection()}
    </div>
  );

  // Render model selection section
  const renderModelSelection = () => {
    if (!selectedManufacturer) return null;

    return (
      <div className="mt-3">
        <div className="mb-2 flex justify-between items-center">
          <label className="text-sm font-medium text-gray-700">Model</label>
          {selectedModel && (
            <button
              onClick={() => selectModel(null)}
              className="text-xs text-indigo-600 hover:text-indigo-800"
            >
              Clear
            </button>
          )}
        </div>

        {/* Model Dropdown */}
        <div className="relative" ref={modelMenuRef}>
          <button
            className={`w-full flex items-center justify-between px-3 py-2 border ${
              isModelMenuOpen
                ? 'border-indigo-500 ring-1 ring-indigo-300'
                : 'border-gray-300 hover:border-gray-400'
            } rounded-md bg-white transition-colors`}
            onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
          >
            <span className="text-gray-700 truncate">
              {selectedModel || `All Models (${totalActive})`}
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 text-gray-500 transition-transform ${
                isModelMenuOpen ? 'transform rotate-180' : ''
              }`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {/* Model Menu */}
          {isModelMenuOpen && (
            <div
              className="absolute z-20 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 overflow-y-auto"
              style={{ maxHeight: '300px' }}
            >
              <div className="sticky top-0 bg-white border-b z-10">
                <div
                  className="px-3 py-2 hover:bg-indigo-50 cursor-pointer font-medium"
                  onClick={() => handleModelSelect('')}
                >
                  All Models ({totalActive})
                </div>
              </div>

              {Object.entries(groupedModels)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([letter, models]) => (
                  <div key={letter}>
                    <div className="px-3 py-1 text-xs text-gray-500 bg-gray-50 sticky top-10 z-10">
                      {letter}
                    </div>
                    {models
                      .sort((a, b) => a.MODEL.localeCompare(b.MODEL))
                      .map((model) => (
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
          )}
        </div>

        {/* Quick model selection */}
        {renderQuickModelSelection()}
      </div>
    );
  };

  // Render quick model selection
  const renderQuickModelSelection = () => {
    if (modelsByPopularity.length === 0) return null;

    return (
      <div className="mt-3">
        <div className="text-xs text-gray-500 mb-1">Popular models:</div>
        <div className="flex flex-wrap gap-1">
          {modelsByPopularity.map((model) => (
            <div
              key={model.MODEL}
              className={`px-2 py-1 rounded-full text-xs cursor-pointer ${
                selectedModel === model.MODEL
                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                  : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
              }`}
              onClick={() => selectModel(model.MODEL)}
            >
              {model.MODEL} ({model.count})
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render geofence filter section
  const renderGeofenceFilter = () => (
    <div className="mb-4">
      <div className="mb-2 flex justify-between items-center">
        <label className="text-sm font-medium text-gray-700">
          Location Search
        </label>

        {/* Geofence toggle button - simplified version */}
        <button
          onClick={() => {
            if (isGeofenceActive) {
              // Clear geofence
              clearGeofenceData?.();
              setIsGeofenceActive(false);
            } else if (geofenceCoordinates) {
              // Reactivate existing geofence
              toggleGeofence();
              setIsGeofenceActive(true);
              // Restore aircraft data if available
              if (geofenceAircraft.length > 0) {
                updateGeofenceAircraft(geofenceAircraft);
              }
            } else {
              // Just toggle if no other condition applies
              toggleGeofence();
            }
          }}
          className={`px-3 py-1 rounded-md text-sm ${
            isGeofenceActive
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {isGeofenceActive ? 'Geofence Active' : 'Enable Geofence'}
        </button>
      </div>

      <div className="flex flex-col space-y-2">
        <div className="flex space-x-2">
          <input
            type="text"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
            placeholder="ZIP code or coordinates..."
            value={geofenceLocation}
            onChange={(e) => setGeofenceLocation(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !combinedLoading && geofenceLocation) {
                processGeofenceSearch();
              }
            }}
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
              'Search'
            )}
          </button>
        </div>

        <button
          className={`flex items-center justify-center px-3 py-2 border border-indigo-300 rounded-md text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors ${
            isGettingLocation ? 'opacity-75 cursor-not-allowed' : ''
          }`}
          onClick={getUserLocation}
          disabled={isGettingLocation || combinedLoading}
        >
          {isGettingLocation ? (
            <>
              <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
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
          onChange={(e) => setGeofenceRadius(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>5 km</span>
          <span>50 km</span>
          <span>100 km</span>
        </div>
      </div>

      {/* Clear button shown when geofence is active */}
      {isGeofenceActive && (
        <div className="mt-3">
          <button
            onClick={() => {
              clearGeofence();
              setGeofenceLocation('');
              setGeofenceCoordinates(null);
              setGeofenceAircraft([]);
              setIsGeofenceActive(false);
              clearGeofenceData?.();
            }}
            className="w-full px-3 py-2 border border-red-200 text-red-600 rounded-md text-sm font-medium hover:bg-red-50"
          >
            Clear Geofence
          </button>
        </div>
      )}

      {renderGeofenceInfo()}
    </div>
  );

  // Render geofence information
  const renderGeofenceInfo = () => {
    if (!isGeofenceActive || !geofenceCoordinates) return null;

    return (
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
                <div key={aircraft.ICAO24} className="text-xs mt-0.5">
                  {aircraft.ICAO24} •{' '}
                  {aircraft.MODEL || aircraft.TYPE_AIRCRAFT || 'Unknown'} •
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
    );
  };

  // Render aircraft info section
  const renderAircraftInfo = () => (
    <div className="bg-gray-50 p-3 rounded-md mt-1">
      <div className="text-sm">
        <div className="flex items-center text-indigo-700 font-medium mb-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-1"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
          {selectedModel ? (
            <span>
              Tracking{' '}
              {activeModels.find((m) => m.MODEL === selectedModel)?.count || 0}{' '}
              aircraft
            </span>
          ) : isGeofenceActive ? (
            <span>Tracking {geofenceAircraft.length} aircraft</span>
          ) : selectedManufacturer ? (
            <span>
              Tracking {totalActive} aircraft across {activeModels.length}{' '}
              models
            </span>
          ) : filterMode === 'owner' && displayedAircraft ? (
            <span>
              Tracking {displayedAircraft.length} aircraft by owner type
            </span>
          ) : (
            <span>No aircraft selected</span>
          )}
        </div>

        {combinedLoading && (
          <div className="text-xs text-indigo-600 mt-1 flex items-center">
            <svg
              className="animate-spin h-3 w-3 mr-1"
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
            Loading aircraft data...
          </div>
        )}
      </div>
    </div>
  );

  // Step 7: Render region filter section
  const renderRegionFilter = () => (
    <div className="p-4 border-b border-gray-200">
      <div className="mb-2 flex justify-between items-center">
        <label className="text-sm font-medium text-gray-700">
          Region Filter
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
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

      {selectedRegion && displayedAircraft && (
        <div className="mt-3 text-xs text-gray-500">
          Viewing aircraft in {selectedRegion} region
        </div>
      )}
    </div>
  );

  // Render status information
  const renderStatusInfo = () => (
    <div className="p-2 text-xs text-gray-500 bg-gray-50 mt-2 rounded-md">
      <div>Mode: {filterMode}</div>
      <div>Manufacturer: {selectedManufacturer || 'None'}</div>
      <div className="flex items-center">
        Geofence:
        <span
          className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${isGeofenceActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
        >
          {isGeofenceActive ? 'Active' : 'Inactive'}
        </span>
      </div>
      {filterMode === 'owner' && (
        <div>Owner filters: {ownerFilters.length} selected</div>
      )}
      {filterMode === 'region' && (
        <div>Region: {selectedRegion || 'Global'}</div>
      )}
      <div>
        Aircraft count:{' '}
        {filterMode === 'geofence' || filterMode === 'both'
          ? geofenceAircraft.length
          : filterMode === 'owner' || filterMode === 'region'
            ? displayedAircraft?.length || 0
            : totalActive}
      </div>
    </div>
  );

  // Render action buttons
  const renderActionButtons = () => (
    <div className="flex space-x-2 mt-4">
      <button
        onClick={() => {
          // Clear owner filters
          setOwnerFilters([]);

          // Clear region state
          setActiveRegion(null);

          // Properly remove the region outline from the map
          if (regionOutline) {
            // Make sure we're calling the remove method properly
            if (typeof regionOutline.remove === 'function') {
              regionOutline.remove();
            } else if (
              regionOutline.rectangle &&
              typeof regionOutline.rectangle.remove === 'function'
            ) {
              regionOutline.rectangle.remove();
            }

            // If we have separate references to the rectangle and label
            if (
              regionOutline.label &&
              typeof regionOutline.label.remove === 'function'
            ) {
              regionOutline.label.remove();
            }

            // Reset the state
            setRegionOutline(null);
          }

          // Reset map view if needed
          if (mapInstance) {
            const globalBounds = getBoundsByRegion(MAP_CONFIG.REGIONS.GLOBAL);
            mapInstance.fitBounds(globalBounds as any);
          }
        }}
        className="text-xs text-indigo-600 hover:text-indigo-800"
      >
        Clear All
      </button>
      <button
        onClick={handleManualRefresh}
        className={`flex-1 flex items-center justify-center px-3 py-2 ${
          isRefreshing
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-700'
        } text-white font-medium rounded-md`}
        disabled={
          isRefreshing ||
          (filterMode !== 'owner' && !selectedManufacturer && !isGeofenceActive)
        }
      >
        {isRefreshing ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
          'Refresh Data'
        )}
      </button>
    </div>
  );

  // Now update the main return statement to use these rendering functions
  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 1000,
        maxWidth: 'calc(100vw - 40px)',
        maxHeight: selectorMinimized ? '40px' : 'calc(100vh - 40px)', // Hard set the max height when minimized
        overflow: 'hidden', // Important to hide content
      }}
      className={`bg-white rounded-lg shadow-xl border border-gray-200 w-96 transition-all duration-300 select-none ${
        selectorMinimized ? 'minimized-selector' : ''
      }`}
    >
      {/* Header - now with minimize button */}
      {renderHeader()}

      {/* Content */}
      {!selectorMinimized && (
        <>
          {/* Filter Toggle */}
          {renderFilterToggle()}

          {/* Owner Type Filter Section */}
          {filterMode === 'owner' && renderOwnerTypeFilter()}

          <div className="p-4">
            {/* Manufacturer Filter Section */}
            {(filterMode === 'manufacturer' || filterMode === 'both') &&
              renderManufacturerFilter()}
            {/* Geofence Filter Section */}
            {(filterMode === 'geofence' || filterMode === 'both') &&
              renderGeofenceFilter()}

            {/* region filter section */}
            {filterMode === 'region' && renderRegionFilter()}

            {/* Active Aircraft Info */}
            {renderAircraftInfo()}
            {/* Status Information */}
            {renderStatusInfo()}
            {/* Action Buttons */}
            {renderActionButtons()}
          </div>
        </>
      )}
    </div>
  );
};

export default UnifiedAircraftSelector;
