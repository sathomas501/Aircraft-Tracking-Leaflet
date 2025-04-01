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
} from '../../../lib/services/geofencing';
import { enrichGeofenceAircraft } from '../../../lib/utils/geofenceEnricher';
import { useGeolocation } from '../hooks/useGeolocation';

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

  // Only showing the modified processGeofenceSearch function
  const processGeofenceSearch = async () => {
    if (!geofenceLocation) return;

    // Set loading state
    setLocalLoading(true);

    try {
      // Check if input might be a ZIP code (5 digits)
      const zipRegex = /^\s*\d{5}\s*$/;
      const isZipCode = zipRegex.test(geofenceLocation);

      // Check if input is coordinates (simple regex check)
      const coordRegex =
        /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/;
      const isCoordinates = coordRegex.test(geofenceLocation);

      let fetchedAircraft: ExtendedAircraft[] = [];
      let coordinates: { lat: number; lng: number } | null = null;

      if (isZipCode) {
        // If it's a ZIP code, use the ZIP-specific function
        console.log(
          `Searching for aircraft near ZIP code: ${geofenceLocation}`
        );
        fetchedAircraft = await getAircraftNearZipCode(
          geofenceLocation,
          geofenceRadius
        );

        // Get coordinates for the map
        coordinates = await zipCodeToCoordinates(geofenceLocation);
      } else if (isCoordinates) {
        // Parse coordinates from input
        const [lat, lng] = geofenceLocation
          .split(',')
          .map((coord) => parseFloat(coord.trim()));
        console.log(`Searching for aircraft near coordinates: ${lat}, ${lng}`);

        fetchedAircraft = await getAircraftNearLocation(
          lat,
          lng,
          geofenceRadius
        );
        coordinates = { lat, lng };
      } else {
        // Try to handle as place name by getting coordinates first
        try {
          // Call geocoding API through proxy
          const response = await fetch(
            `/api/proxy/geocode?place=${encodeURIComponent(geofenceLocation)}`
          );

          if (!response.ok) {
            throw new Error('Failed to geocode location');
          }

          const geocodeData = await response.json();

          if (
            geocodeData.result?.addressMatches &&
            geocodeData.result.addressMatches.length > 0 &&
            geocodeData.result.addressMatches[0].coordinates
          ) {
            const coords = geocodeData.result.addressMatches[0].coordinates;
            coordinates = {
              lat: coords.y,
              lng: coords.x,
            };

            console.log(
              `Found coordinates for "${geofenceLocation}": ${coordinates.lat}, ${coordinates.lng}`
            );
            fetchedAircraft = await getAircraftNearLocation(
              coordinates.lat,
              coordinates.lng,
              geofenceRadius
            );
          } else {
            throw new Error('Location not found');
          }
        } catch (geocodeError) {
          console.error('Geocoding error:', geocodeError);
          throw new Error(
            `Could not find location "${geofenceLocation}". Try using a ZIP code or coordinates.`
          );
        }
      }

      // Update state with the results
      if (coordinates) {
        setGeofenceCoordinates(coordinates);
      } else {
        throw new Error('Could not determine coordinates for the location');
      }

      console.log(
        `Found ${fetchedAircraft.length} aircraft in the area, preparing for display...`
      );

      if (fetchedAircraft.length === 0) {
        alert(
          `No aircraft found near ${geofenceLocation}. Try increasing the radius or searching in a different area.`
        );
        setLocalLoading(false);
        return;
      }

      // Step 1: First adapt the raw geofence data to normalized format
      const adaptedAircraft = adaptGeofenceAircraft(fetchedAircraft);

      // Step 2: Now enrich the adapted aircraft with data from the tracking API
      console.log('Enriching geofence aircraft with static data...');
      const enrichedAircraft = await enrichGeofenceAircraft(adaptedAircraft);

      // Log the first aircraft after enrichment for debugging
      if (enrichedAircraft.length > 0) {
        console.log('Enriched aircraft sample:', {
          icao24: enrichedAircraft[0].icao24,
          manufacturer: enrichedAircraft[0].manufacturer,
          model: enrichedAircraft[0].model,
          type: enrichedAircraft[0].type,
          isGovernment: enrichedAircraft[0].isGovernment,
          hasStaticData: enrichedAircraft[0].manufacturer !== 'Unknown',
        });
      }

      // Save to local state for display in the UI
      setGeofenceAircraft(enrichedAircraft);

      // Important: Clear any existing aircraft data first
      if (clearGeofenceData) {
        clearGeofenceData();
        console.log('Cleared existing aircraft data');
      }

      // Use the updateGeofenceAircraft function from context
      // Delay slightly to ensure UI updates properly
      setTimeout(() => {
        updateGeofenceAircraft(enrichedAircraft);
        console.log(
          `Sent ${enrichedAircraft.length} enriched aircraft to map for display`
        );
        setIsGeofenceActive(true);

        // Center the map
        if (mapInstance && coordinates) {
          // Calculate map bounds based on radius
          const radiusInDegrees = geofenceRadius / 111; // Rough conversion from km to degrees
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

          // First set the view to ensure the map is looking at the right area
          mapInstance.setView([coordinates.lat, coordinates.lng], 9);

          // Then fit bounds after a short delay to ensure the map is ready
          setTimeout(() => {
            mapInstance.fitBounds(bounds as any);
            console.log(
              `Map centered on area: ${coordinates.lat}, ${coordinates.lng} with radius ${geofenceRadius}km`
            );

            // Force a refresh of the map tiles (sometimes helps with marker rendering)
            mapInstance.invalidateSize();
          }, 200);
        }
      }, 100);
    } catch (error) {
      console.error('Error in geofence search:', error);
      // Show error to the user
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

  // Toggle filter mode
  const toggleFilterMode = (mode: 'manufacturer' | 'geofence' | 'both') => {
    setFilterMode(mode);

    // Apply appropriate filters based on new mode
    if (mode === 'manufacturer') {
      if (isGeofenceActive) {
        setGeofenceAircraft([]);
        setIsGeofenceActive(false);
        clearGeofenceData?.();
      }
    } else if (mode === 'geofence') {
      selectManufacturer(null);
      selectModel(null);

      if (geofenceCoordinates && geofenceAircraft.length > 0) {
        updateAircraftData(geofenceAircraft);
      }
    }
    // Both mode keeps current selections
  };

  // Group models alphabetically for the dropdown
  const groupedModels = activeModels.reduce(
    (groups: Record<string, AircraftModel[]>, model) => {
      const firstChar = model.model.charAt(0).toUpperCase();
      if (!groups[firstChar]) {
        groups[firstChar] = [];
      }
      groups[firstChar].push(model);
      return groups;
    },
    {}
  );

  // Handle selecting a manufacturer
  const selectManufacturerAndClose = (value: string) => {
    selectManufacturer(value === '' ? null : value);
    setIsManufacturerMenuOpen(false);
    setManufacturerSearchTerm('');

    // If we're in geofence mode, switch to manufacturer or both
    if (filterMode === 'geofence') {
      setFilterMode(isGeofenceActive ? 'both' : 'manufacturer');
    }
  };

  // Handle selecting a model
  const handleModelSelect = (value: string) => {
    selectModel(value === '' ? null : value);
    setIsModelMenuOpen(false);
  };

  // Add this handler function for the refresh button that works with both search types
  const handleManualRefresh = async () => {
    // Don't allow refreshing if we're already refreshing
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);

    try {
      // Check which mode we're in and refresh accordingly
      if (
        filterMode === 'manufacturer' ||
        (filterMode === 'both' && selectedManufacturer)
      ) {
        // Manufacturer search refresh
        console.log('Refreshing manufacturer aircraft data...');

        if (!selectedManufacturer) {
          console.log('No manufacturer selected, skipping refresh');
          return;
        }

        // Use the context's refreshPositions function for manufacturer refresh
        await refreshPositions();
        console.log('Manufacturer aircraft data refreshed');
      } else if (
        filterMode === 'geofence' ||
        (filterMode === 'both' && isGeofenceActive)
      ) {
        // Geofence search refresh
        console.log('Refreshing geofence aircraft data...');

        if (!geofenceCoordinates || !isGeofenceActive) {
          console.log('No active geofence, skipping refresh');
          return;
        }

        // Get fresh aircraft data using current coordinates
        const refreshedAircraft = await getAircraftNearLocation(
          geofenceCoordinates.lat,
          geofenceCoordinates.lng,
          geofenceRadius
        );

        console.log(
          `Refreshed data: Found ${refreshedAircraft.length} aircraft in the area`
        );

        // Process the new data
        if (refreshedAircraft.length > 0) {
          // Step 1: Adapt the new geofence data
          const adaptedAircraft = adaptGeofenceAircraft(refreshedAircraft);

          // Step 2: Enrich with static data
          const enrichedAircraft =
            await enrichGeofenceAircraft(adaptedAircraft);

          // Update local state
          setGeofenceAircraft(enrichedAircraft);

          // Update the map
          updateGeofenceAircraft(enrichedAircraft);

          console.log(
            `Successfully refreshed ${enrichedAircraft.length} aircraft`
          );
        } else {
          console.log('No aircraft found in refresh');
        }
      } else if (filterMode === 'both') {
        // Combined mode - do both refreshes
        console.log('Refreshing both manufacturer and geofence data...');

        // First refresh manufacturer data if available
        if (selectedManufacturer) {
          await refreshPositions();
          console.log('Manufacturer aircraft data refreshed');
        }

        // Then refresh geofence data if available
        if (geofenceCoordinates && isGeofenceActive) {
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
      } else {
        console.log('No active search to refresh');
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
        maxHeight: 'calc(100vh - 40px)',
      }}
      className="bg-white rounded-lg shadow-xl border border-gray-200 w-96 transition-all duration-300 select-none"
    >
      {/* Header */}
      <div
        className="bg-indigo-600 text-white px-4 py-3 flex justify-between items-center cursor-grab drag-handle"
        onMouseDown={startDragging}
      >
        <h2 className="font-semibold text-center w-full flex items-center justify-center">
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
      </div>

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
                              .sort((a, b) => a.model.localeCompare(b.model))
                              .map((model) => (
                                <div
                                  key={model.model}
                                  className={`px-3 py-2 hover:bg-indigo-50 cursor-pointer flex justify-between ${
                                    selectedModel === model.model
                                      ? 'bg-indigo-50 font-medium text-indigo-700'
                                      : 'text-gray-700'
                                  }`}
                                  onClick={() => handleModelSelect(model.model)}
                                >
                                  <span>{model.model}</span>
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
                      key={model.model}
                      className={`px-2 py-1 rounded-full text-xs cursor-pointer ${
                        selectedModel === model.model
                          ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                          : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                      }`}
                      onClick={() => selectModel(model.model)}
                    >
                      {model.model} ({model.count})
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
                  placeholder="ZIP code, city, or coordinates..."
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
                onChange={(e) => setGeofenceRadius(parseInt(e.target.value))}
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
                        <div key={aircraft.icao24} className="text-xs mt-0.5">
                          {aircraft.icao24} •{' '}
                          {aircraft.model ||
                            aircraft.TYPE_AIRCRAFT ||
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
                  {activeModels.find((m) => m.model === selectedModel)?.count ||
                    0}{' '}
                  aircraft
                </span>
              ) : isGeofenceActive ? (
                <span>Tracking {geofenceAircraft.length} aircraft</span>
              ) : selectedManufacturer ? (
                <span>
                  Tracking {totalActive} aircraft across {activeModels.length}{' '}
                  models
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
            className={`flex items-center justify-center px-4 py-2 ${
              isRefreshing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700'
            } text-white font-medium rounded-md w-full`}
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
    </div>
  );
};

export default UnifiedAircraftSelector;
