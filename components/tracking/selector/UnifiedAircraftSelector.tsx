import React, { useState, useEffect, useRef } from 'react';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import type { SelectOption } from '@/types/base';
import type { ExtendedAircraft } from '../../../types/base';
import type { AircraftModel } from '../../../types/aircraft-models';
import { adaptGeofenceAircraft } from '../../../lib/utils/geofenceAdapter';
import {
  postalCodeToCoordinates,
  getAircraftNearPostalCode,
  getAircraftNearLocation,
  calculateDistance,
  searchLocationWithMapbox,
  getAircraftNearSearchedLocation,
} from '../../../lib/services/geofencing';
import { enrichGeofenceAircraft } from '../../../lib/utils/geofenceEnricher';
import { useGeolocation } from '../hooks/useGeolocation';
import openSkyTrackingService from '@/lib/services/openSkyTrackingService';
import OwnershipTypeFilter from '../map/components/OwnershipTypeFilter';

interface UnifiedAircraftSelectorProps {
  manufacturers: SelectOption[];
}

type OwnershipTypeFilterProps = {
  onFilterChange: (selectedTypes: string[]) => void;
  activeFilters: string[];
};

const UnifiedAircraftSelector: React.FC<UnifiedAircraftSelectorProps> = ({
  manufacturers,
}) => {
  // Context state - add updateGeofenceAircraft to your destructuring
  // At the top of your UnifiedAircraftSelector component, update your context destructuring
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

  // Add to your geofence state section
  const combinedLoading = isLoading || localLoading;

  // Local state
  const [filterMode, setFilterMode] = useState<
    'manufacturer' | 'geofence' | 'both' | 'owner'
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
  const [isGeofenceActive, setIsGeofenceActive] = useState(false);
  const [combinedModeReady, setCombinedModeReady] = useState<boolean>(false);

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

  const handleOwnerFilterChange = (types: string[]) => {
    setOwnerFilters(types);
  };

  // Reset owner filters to select all
  const resetOwnerFilters = () => {
    setOwnerFilters([...allOwnerTypes]);
  };

  // Define these helper functions before they're used in useMemo
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
   *
   * @param manufacturerValue The selected manufacturer
   * @param modelValue The selected model (optional)
   * @param geofenceAircraftList The geofence aircraft list
   */
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

  /**tsc
   * Enhanced toggleFilterMode function
   * Ensures no searches start until both selection criteria are met
   */
  const toggleFilterMode = (
    mode: 'manufacturer' | 'geofence' | 'both' | 'owner'
  ) => {
    setFilterMode(mode);

    // Apply appropriate filters based on new mode
    if (mode === 'manufacturer') {
      // Allow API calls in manufacturer mode
      openSkyTrackingService.setBlockAllApiCalls(false);

      if (isGeofenceActive) {
        // Clear geofence data but keep the settings
        clearGeofenceData?.();
        console.log(
          'Cleared geofence data, switching to manufacturer-only mode'
        );

        // If we have manufacturer data, make sure it's displayed
        if (selectedManufacturer) {
          // The existing context functions will handle this display
          console.log(`Displaying all ${selectedManufacturer} aircraft`);
        }
      }
    } else if (mode === 'geofence') {
      // Block API calls in geofence mode
      openSkyTrackingService.setBlockAllApiCalls(true);

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
    }
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

        {/* Add minimize/maximize button */}
        <button
          onClick={toggleMinimized}
          className="text-white hover:bg-indigo-700 p-1 rounded focus:outline-none"
          title={selectorMinimized ? 'Expand' : 'Minimize'}
        >
          {selectorMinimized ? '▲' : '▼'}
        </button>
      </div>

      {/* Content */}
      {!selectorMinimized && (
        <>
          {/* Filter Toggle */}
          <div className="flex border-b">
            <button
              className={`flex-1 py-2 text-sm font-medium ${
                filterMode === 'manufacturer' || filterMode === 'both'
                  ? 'text-indigo-600 border-b-2 border-indigo-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => toggleFilterMode('manufacturer')}
            >
              By Manufacturer
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium ${
                filterMode === 'geofence' || filterMode === 'both'
                  ? 'text-indigo-600 border-b-2 border-indigo-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => toggleFilterMode('geofence')}
            >
              By Location
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

          {/* Owner Type Filter Section */}
          {filterMode === 'owner' && (
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
                    onClick={() => setOwnerFilters([])}
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
          )}
          <div className="p-4">
            {/* Manufacturer Filter Section */}
            {(filterMode === 'manufacturer' || filterMode === 'both') && (
              <div
                className={`mb-4 ${filterMode === 'both' ? 'pb-3 border-b border-gray-200' : ''}`}
              >
                {/* Manufacturer section content */}
                {/* ... */}
                {/* Keep all the manufacturer dropdown UI here */}
              </div>
            )}

            {/* Geofence Filter Section */}
            {(filterMode === 'geofence' || filterMode === 'both') && (
              <div className="mb-4">
                {/* Geofence section content */}
                {/* ... */}
                {/* Keep all the geofence UI here */}
              </div>
            )}

            {/* Active Aircraft Info */}
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
                      {activeModels.find((m) => m.MODEL === selectedModel)
                        ?.count || 0}{' '}
                      aircraft
                    </span>
                  ) : isGeofenceActive ? (
                    <span>Tracking {geofenceAircraft.length} aircraft</span>
                  ) : selectedManufacturer ? (
                    <span>
                      Tracking {totalActive} aircraft across{' '}
                      {activeModels.length} models
                    </span>
                  ) : filterMode === 'owner' && displayedAircraft ? (
                    <span>Tracking {displayedAircraft.length} aircraft by owner type</span>
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

            {/* Status Information */}
            <div className="p-2 text-xs text-gray-500 bg-gray-50 mt-2 rounded-md">
              <div>Mode: {filterMode}</div>
              <div>Manufacturer: {selectedManufacturer || 'None'}</div>
              <div>Geofence: {isGeofenceActive ? 'Active' : 'Inactive'}</div>
              {filterMode === 'owner' && (
                <div>Owner filters: {ownerFilters.length} selected</div>
              )}
              <div>
                Aircraft count:{' '}
                {filterMode === 'geofence' || filterMode === 'both'
                  ? geofenceAircraft.length
                  : filterMode === 'owner' 
                  ? displayedAircraft?.length || 0
                  : totalActive}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2 mt-4">
              <button
                onClick={() => clearAllFilters()}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Clear All Filters
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
          </div>
        </>
      )}
    </div>
  );