import React, { useState, useEffect, useRef } from 'react';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import type { SelectOption } from '@/types/base';
import type { ExtendedAircraft } from '../../../types/base';
import type { AircraftModel } from '../../../types/aircraft-models';
import { adaptGeofenceAircraft } from '../../../lib/utils/geofenceAdapter';
import {
  zipCodeToCoordinates,
  getAircraftNearZipCode,
  getAircraftNearLocation,
  calculateDistance,
  searchLocationWithMapbox,
  getAircraftNearSearchedLocation,
} from '../../../lib/services/geofencing';
import { enrichGeofenceAircraft } from '../../../lib/utils/geofenceEnricher';
import { useGeolocation } from '../hooks/useGeolocation';
import openSkyTrackingService from '@/lib/services/openSkyTrackingService';

interface UnifiedAircraftSelectorProps {
  manufacturers: SelectOption[];
}

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
    refreshPositions, // Add this line
    mapInstance,
    updateAircraftData,
    clearGeofenceData,
    updateGeofenceAircraft,
    blockManufacturerApiCalls,
    setBlockManufacturerApiCalls,
    isManufacturerApiBlocked,
    setIsManufacturerApiBlocked,
  } = useEnhancedMapContext();

  // Local state for geofence loading
  const [localLoading, setLocalLoading] = useState(false);

  // Add to your geofence state section
  const combinedLoading = isLoading || localLoading;

  // Local state
  const [filterMode, setFilterMode] = useState<
    'manufacturer' | 'geofence' | 'both'
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

      // This will handle ZIP codes, place names, addresses, POIs, etc.
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

      // Fallback for ZIP codes
      if (!coordinates && /^\d{5}$/.test(geofenceLocation.trim())) {
        try {
          coordinates = await zipCodeToCoordinates(geofenceLocation);
        } catch (zipError) {
          console.error('Error getting coordinates from ZIP code', zipError);
        }
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
  const toggleFilterMode = (mode: 'manufacturer' | 'geofence' | 'both') => {
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
            {/* Your existing toggle buttons */}
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
          </div>

          <div className="p-4">
            {/* Manufacturer Filter Section */}
            {(filterMode === 'manufacturer' || filterMode === 'both') && (
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
                    onClick={() =>
                      setIsManufacturerMenuOpen(!isManufacturerMenuOpen)
                    }
                  >
                    {selectedManufacturer ? (
                      <span className="text-indigo-700 font-medium truncate">
                        {manufacturers.find(
                          (m) => m.value === selectedManufacturer
                        )?.label || selectedManufacturer}
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
                          onChange={(e) =>
                            setManufacturerSearchTerm(e.target.value)
                          }
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
                            onClick={() =>
                              selectManufacturerAndClose(manufacturer.value)
                            }
                          >
                            {manufacturer.label}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Model Selection - Only show if manufacturer selected */}
                {selectedManufacturer && (
                  <div className="mt-3">
                    <div className="mb-2 flex justify-between items-center">
                      <label className="text-sm font-medium text-gray-700">
                        Model
                      </label>
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
                                  .sort((a, b) =>
                                    a.MODEL.localeCompare(b.MODEL)
                                  )
                                  .map((model) => (
                                    <div
                                      key={model.MODEL}
                                      className={`px-3 py-2 hover:bg-indigo-50 cursor-pointer flex justify-between ${
                                        selectedModel === model.MODEL
                                          ? 'bg-indigo-50 font-medium text-indigo-700'
                                          : 'text-gray-700'
                                      }`}
                                      onClick={() =>
                                        handleModelSelect(model.MODEL)
                                      }
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
                  </div>
                )}

                {/* Quick model selection */}
                {selectedManufacturer && modelsByPopularity.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-500 mb-1">
                      Popular models:
                    </div>
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
                )}
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
                      onClick={() => {
                        setGeofenceLocation('');
                        setGeofenceCoordinates(null);
                        setGeofenceAircraft([]);
                        setIsGeofenceActive(false);
                        clearGeofenceData?.();
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      Clear
                    </button>
                  )}
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
                        if (
                          e.key === 'Enter' &&
                          !combinedLoading &&
                          geofenceLocation
                        ) {
                          processGeofenceSearch();
                        }
                      }}
                    />
                    <button
                      className={`px-3 py-2 rounded-md text-white ${
                        combinedLoading ||
                        (!geofenceLocation && !isGettingLocation)
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                      onClick={processGeofenceSearch}
                      disabled={
                        combinedLoading ||
                        (!geofenceLocation && !isGettingLocation)
                      }
                    >
                      {combinedLoading ? (
                        <svg
                          className="animate-spin h-5 w-5"
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
                    onChange={(e) =>
                      setGeofenceRadius(parseInt(e.target.value))
                    }
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>5 km</span>
                    <span>50 km</span>
                    <span>100 km</span>
                  </div>
                </div>

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
                            <div
                              key={aircraft.ICAO24}
                              className="text-xs mt-0.5"
                            >
                              {aircraft.ICAO24} •{' '}
                              {aircraft.MODEL ||
                                aircraft.AIRCRAFT_TYPE ||
                                'Unknown'}{' '}
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

            <div className="p-2 text-xs text-gray-500">
              <div>Mode: {filterMode}</div>
              <div>Manufacturer: {selectedManufacturer || 'None'}</div>
              <div>Geofence: {isGeofenceActive ? 'Active' : 'Inactive'}</div>
              <div>Combined ready: {combinedModeReady ? 'Yes' : 'No'}</div>
              <div>
                Aircraft count:{' '}
                {filterMode === 'geofence' || filterMode === 'both'
                  ? geofenceAircraft.length
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
                  isRefreshing || (!selectedManufacturer && !isGeofenceActive)
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
};

export default UnifiedAircraftSelector;
