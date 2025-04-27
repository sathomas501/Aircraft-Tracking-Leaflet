// components/tracking/hooks/useFilterLogic.ts

import { useState, useRef, useEffect, useCallback } from 'react';
import React from 'react';
import { ExtendedAircraft, RegionCode } from '@/types/base';
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
import {
  MAP_CONFIG,
  getBoundsByRegion,
  getZoomLevelForRegion,
} from '../../../config/map';
import type { 
  FilterLogicReturnType, 
  FilterMode,
  DropdownRefs, ModelOption
} from '../types/filters';

// Type guards for error handling
function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as any).message === 'string'
  );
}

function isErrorWithStatus(error: unknown): error is { status: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as any).status === 'number'
  );
}

function getErrorMessage(error: unknown): string {
  if (isErrorWithMessage(error)) {
    return error.message;
  }
  return String(error);
}

export function useFilterLogic(): FilterLogicReturnType {
  // Get context - FIXING THE RECURSION ISSUE
  // DO NOT USE useFilterLogic here again! Use useEnhancedMapContext directly
  const mapContext = useEnhancedMapContext();

  // Local state for filter management
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('OR');
  const [selectedManufacturer, setSelectedManufacturer] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [manufacturerSearchTerm, setManufacturerSearchTerm] = useState<string>('');
  const [ownerFilters, setOwnerFilters] = useState<string[]>([]);
  const [allOwnerTypes, setAllOwnerTypes] = useState<string[]>([]);
  const [activeRegionState, setActiveRegionState] = useState<RegionCode | null>(null);
  const [geofenceLocation, setGeofenceLocation] = useState<string>('');
  const [geofenceRadius, setGeofenceRadius] = useState<number>(50);
  const [geofenceCoordinates, setGeofenceCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [isGeofenceActive, setIsGeofenceActive] = useState<boolean>(false);

  // Extract from map context
  const {
    mapInstance,
    displayedAircraft,
    totalActive,
    isLoading: mapLoading,
    refreshPositions,
    reset,
    fullRefresh,
    clearGeofenceData,
    updateGeofenceAircraft: mapUpdateGeofenceAircraft,
    toggleGeofence,
    clearGeofence,
    geofenceCenter,
  } = mapContext;

  // Create local state
  const [localLoading, setLocalLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [rateLimitTimer, setRateLimitTimer] = useState<number | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [geofenceAircraft, setGeofenceAircraft] = useState<ExtendedAircraft[]>(
    []
  );
  const [regionOutline, setRegionOutline] = useState<any>(null);
  const [selectedRegion, setSelectedRegion] = useState<number>(
    MAP_CONFIG.REGIONS.GLOBAL
  );

  const [regionCounts, setRegionCounts] = useState({
    totalActive: 0,
    manufacturerCount: 0,
    modelCount: 0,
    selectedManufacturerCount: 0,
    selectedModelCount: 0,
  });

  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [quotaUsage, setQuotaUsage] = useState<{ used: number; total: number }>({
    used: 0,
    total: 400,
  });
  const [notification, setNotification] = useState<string | null>(null);
  const [showLiveData, setShowLiveData] = useState<boolean>(false);
  const [manufacturers, setManufacturers] = useState<any[]>([]);
  const [modelOptions, setModelOptions] = useState<ModelOption[] | null>(null);
  const [isLoadingManufacturers, setIsLoadingManufacturers] = useState(false);

  const [isGeofencePlacementMode, setIsGeofencePlacementMode] = useState(false);


  // Dropdown refs
  const dropdownRefs: DropdownRefs = {
    filter: useRef<HTMLDivElement>(null),
    manufacturer: useRef<HTMLDivElement>(null),
    model: useRef<HTMLDivElement>(null),
    location: useRef<HTMLDivElement>(null),
    region: useRef<HTMLDivElement>(null),
    owner: useRef<HTMLDivElement>(null),
    actions: useRef<HTMLDivElement>(null),
  };

  // Use geolocation hook
  const geolocationServices = useGeolocationServices();

  // Define our implementation of setGeofenceCenter
  const setGeofenceCenter = useCallback(
    (coords: { lat: number; lng: number }) => {
      console.log('Setting geofence center:', coords);
      // Additional implementation if needed
    },
    []
  );

  // Toggle geofence active state
  const toggleGeofenceActive = useCallback((active: boolean) => {
    setIsGeofenceActive(active);
  }, []);

  const refreshWithFilters = useCallback(() => {
    if (typeof refreshPositions === 'function') {
      refreshPositions().catch((error) => {
        console.error('Error refreshing positions:', error);
      });
    }
  }, [refreshPositions]);

const setActiveRegion = useCallback((region: RegionCode | string | null) => {
  if (region === 'all' || region === '') {
    setActiveRegionState(null);
  } else if (typeof region === 'string') {
    // Convert string to RegionCode if needed
    setActiveRegionState(region as unknown as RegionCode);
  } else {
    setActiveRegionState(region);
  }
}, []);

  // Error handler
  const handleError = useCallback((message: string) => {
    console.error(`[FilterLogic] Error: ${message}`);
  }, []);

  // Rate limit handler
  const handleRateLimit = useCallback(
    (retryAfter: number = 30) => {
      setIsRateLimited(true);
      setRateLimitTimer(retryAfter);
      console.log(`Rate limited by API. Retry after ${retryAfter}s`);

      // Block API calls
      openSkyTrackingService.setBlockAllApiCalls(true);
      // Simply log since we might not have the actual implementation
      console.log('Blocking manufacturer API calls');

      if (retryAfter > 0) {
        alert(
          `Aircraft data refresh rate limited. Please wait ${retryAfter} seconds before trying again.`
        );
      }
    },
    []
  );

  // Process geofence search
  const processGeofenceSearch = useCallback(async () => {
    if (!geofenceLocation) return;

    if (isRateLimited) {
      alert(
        `Rate limited. Please wait ${rateLimitTimer || 30} seconds before searching again.`
      );
      return;
    }

    // Block API calls in combined mode
    if (filterMode === 'both') {
      openSkyTrackingService.setBlockAllApiCalls(true);
      console.log('Blocking manufacturer API calls');
    }

    setLocalLoading(true);

    try {
      console.log(`Searching for aircraft near location: "${geofenceLocation}"`);

      // Search for aircraft near location
      let fetchedAircraft;
      try {
        fetchedAircraft = await getAircraftNearSearchedLocation(
          geofenceLocation,
          geofenceRadius
        );
      } catch (error: any) {
        if (error.message?.includes('rate limit') || error.status === 429) {
          handleRateLimit(30);
          setLocalLoading(false);
          return;
        }
        throw error;
      }

      // Get coordinates for the location
      let locations: { lat: number; lng: number; name: string }[];
      try {
        locations = await MapboxService.searchLocationWithMapbox(
          geofenceLocation,
          1
        );
      } catch (error) {
        console.error('Error searching location with Mapbox:', error);
        locations = [];
      }

      let coordinates: { lat: number; lng: number } | null = null;

      if (locations.length > 0) {
        coordinates = {
          lat: locations[0].lat,
          lng: locations[0].lng,
        };
        setGeofenceLocation(locations[0].name);
      } else if (
        fetchedAircraft.length > 0 &&
        fetchedAircraft[0].latitude &&
        fetchedAircraft[0].longitude
      ) {
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
      }

      // Activate geofence if not already active
      if (!isGeofenceActive) {
        setIsGeofenceActive(true);
        toggleGeofenceActive(true);
        if (toggleGeofence) toggleGeofence();
      } else if (!coordinates) {
        throw new Error('Could not determine coordinates for the location');
      }

      // Process the aircraft data
      const adaptedAircraft =
        fetchedAircraft[0].MANUFACTURER !== undefined
          ? fetchedAircraft
          : adaptGeofenceAircraft(fetchedAircraft);

      const enrichedAircraft = await enrichGeofenceAircraft(adaptedAircraft);
      setGeofenceAircraft(enrichedAircraft);

      // Clear existing data
      if (clearGeofenceData) clearGeofenceData();

      // Update the aircraft display
      if (mapUpdateGeofenceAircraft) {
        mapUpdateGeofenceAircraft(enrichedAircraft);
      }

      // Update the map view
      if (mapInstance && coordinates) {
        const currentZoom = mapInstance.getZoom();
        const targetZoom = currentZoom <= 7 ? 9 : currentZoom;
        mapInstance.setView([coordinates.lat, coordinates.lng], targetZoom);
        mapInstance.invalidateSize();
      }

      // Close dropdown
      setActiveDropdown(null);
    } catch (error) {
      console.error('Error in geofence search:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLocalLoading(false);
    }
  }, [
    geofenceLocation,
    isRateLimited,
    rateLimitTimer,
    filterMode,
    geofenceRadius,
    handleRateLimit,
    setGeofenceLocation,
    setGeofenceCoordinates,
    setGeofenceCenter,
    isGeofenceActive,
    toggleGeofenceActive,
    toggleGeofence,
    clearGeofenceData,
    mapUpdateGeofenceAircraft,
    mapInstance,
    setActiveDropdown,
  ]);

  // Get user location
  const getUserLocation = useCallback(async () => {
    if (isRateLimited) {
      alert(
        `Rate limited. Please wait ${rateLimitTimer || 30} seconds before trying to get location.`
      );
      return;
    }

    setIsGettingLocation(true);
    try {
      const position = await geolocationServices.getCurrentPosition();

      if (position) {
        const { latitude, longitude } = position.coords;

        setGeofenceCoordinates({ lat: latitude, lng: longitude });
        setGeofenceCenter({ lat: latitude, lng: longitude });
        setGeofenceLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);

        // Fetch aircraft near this location
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

          const adaptedAircraft = adaptGeofenceAircraft(fetchedAircraft);
          const enrichedAircraft = await enrichGeofenceAircraft(adaptedAircraft);

          setGeofenceAircraft(enrichedAircraft);

          if (clearGeofenceData) clearGeofenceData();
          if (mapUpdateGeofenceAircraft) mapUpdateGeofenceAircraft(enrichedAircraft);

          setIsGeofenceActive(true);
          toggleGeofenceActive(true);

          // Update map view
          if (mapInstance) {
            const currentZoom = mapInstance.getZoom();
            const targetZoom = currentZoom <= 7 ? 9 : currentZoom;
            mapInstance.setView([latitude, longitude], targetZoom);
            mapInstance.invalidateSize();
          }

          // Set appropriate filter mode
          if (filterMode !== 'geofence' && filterMode !== 'both') {
            setFilterMode('geofence');
          }
        } catch (error: any) {
          if (
            error.message?.includes('rate limit') ||
            error.status === 429
          ) {
            handleRateLimit(30);
          } else {
            throw error;
          }
        }

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
  }, [
    isRateLimited,
    rateLimitTimer,
    geolocationServices,
    setGeofenceCoordinates,
    setGeofenceCenter,
    setGeofenceLocation,
    geofenceRadius,
    handleRateLimit,
    clearGeofenceData,
    mapUpdateGeofenceAircraft,
    setIsGeofenceActive,
    toggleGeofenceActive,
    mapInstance,
    filterMode,
    setFilterMode,
    setActiveDropdown,
  ]);

  // Toggle geofence state
  const toggleGeofenceState = useCallback(
    (enabled?: boolean) => {
      const newState = enabled !== undefined ? enabled : !isGeofenceActive;
      
      if (newState) {
        if (
          geofenceCoordinates &&
          typeof geofenceCoordinates.lat === 'number' &&
          typeof geofenceCoordinates.lng === 'number'
        ) {
          setIsGeofenceActive(true);
          toggleGeofenceActive(true);
          if (toggleGeofence) toggleGeofence();

          if (geofenceAircraft.length > 0) {
            if (mapUpdateGeofenceAircraft) {
              mapUpdateGeofenceAircraft(geofenceAircraft);
            }
          } else {
            processGeofenceSearch();
          }
        } else {
          alert(
            'Please set a location before enabling geofence.\n\nClick anywhere on the map to set a location.'
          );
          setIsGeofenceActive(false);
          toggleGeofenceActive(false);
        }
      } else {
        setIsGeofenceActive(false);
        toggleGeofenceActive(false);
        if (clearGeofenceData) clearGeofenceData();
        if (clearGeofence) clearGeofence();
      }
    },
    [
      isGeofenceActive,
      geofenceCoordinates,
      setIsGeofenceActive,
      toggleGeofenceActive,
      toggleGeofence,
      geofenceAircraft,
      mapUpdateGeofenceAircraft,
      processGeofenceSearch,
      clearGeofenceData,
      clearGeofence,
    ]
  );

  // Toggle dropdown
  const toggleDropdown = useCallback((dropdown: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setActiveDropdown(prev => prev === dropdown ? null : dropdown);
  }, []);

  // Apply combined filters method
  const applyFilters = useCallback((): ExtendedAircraft[] => {
    // Implementation...
    console.log('Applying combined filters');
    return geofenceAircraft; // Return the filtered aircraft array
  }, [geofenceAircraft]);

  // Handler functions for interface compliance
  const handleManufacturerSelect = useCallback(
  async (value: string) => {
    setSelectedManufacturer(value === '' ? null : value);
    
    // If a manufacturer is selected, fetch the models
    if (value && value !== '') {
      try {
        // This could be from cache or an API call
        const modelData = await getModelsForManufacturer(value);
        setModels(modelData);
      } catch (error) {
        console.error('Error loading models:', error);
      }
    } else {
      // Clear models if no manufacturer is selected
      setModels([]);
    }
    
    setActiveDropdown(null);
  },
  [setSelectedManufacturer, setModels, setActiveDropdown]
);

  const handleModelSelect = useCallback(
    (value: string) => {
      setSelectedModel(value === '' ? null : value);
      setActiveDropdown(null);
    },
    [setSelectedModel, setActiveDropdown]
  );

  const handleRegionSelect = useCallback(
  (region: RegionCode) => {
    setActiveRegion(region);
    setSelectedRegion(Number(region));
  },
  [setActiveRegion]
);

  const handleOwnerFilterChange = useCallback(
    (filters: string[]) => {
      setOwnerFilters(filters);
    },
    [setOwnerFilters]
  );

  const toggleFilterMode = useCallback(
    (mode: FilterMode) => {
      setFilterMode(mode);
      setActiveDropdown(null);
    },
    [setFilterMode, setActiveDropdown]
  );

  const selectManufacturerAndClose = useCallback(
    (value: string) => {
      setSelectedManufacturer(value === '' ? null : value);
      setActiveDropdown(null);
    },
    [setSelectedManufacturer, setActiveDropdown]
  );

  // Enhanced clearAllFilters that combines context and local state reset
  const clearAllFilters = useCallback(() => {
    // Reset filter state
    setSelectedManufacturer(null);
    setSelectedModel(null);
    setOwnerFilters([]);
    setActiveRegion(null);
    setIsGeofenceActive(false);
    setGeofenceLocation('');
    setGeofenceCoordinates(null);
    setFilterMode('OR');

    // Reset local state
    setLocalLoading(false);
    setIsRateLimited(false);
    setRateLimitTimer(null);
    setIsGettingLocation(false);
    setLocationName(null);
    setGeofenceAircraft([]);
    setSelectedRegion(MAP_CONFIG.REGIONS.GLOBAL);

    // Clear region outline
    if (regionOutline && typeof regionOutline.remove === 'function') {
      regionOutline.remove();
    }
    setRegionOutline(null);

    // Reset OpenSky tracking
    openSkyTrackingService.setBlockAllApiCalls(false);

    // Reset map view
    if (mapInstance) {
      mapInstance.setView(MAP_CONFIG.CENTER, MAP_CONFIG.DEFAULT_ZOOM);
      mapInstance.invalidateSize();
    }

    // Reset region counts
    setRegionCounts({
      totalActive: 0,
      manufacturerCount: 0,
      modelCount: 0,
      selectedManufacturerCount: 0,
      selectedModelCount: 0,
    });

    // Dispatch clear event for other components
    const clearEvent = new CustomEvent('ribbon-filters-cleared');
    document.dispatchEvent(clearEvent);
  }, [
    setSelectedManufacturer,
    setSelectedModel,
    setOwnerFilters,
    (region: string | RegionCode | null) => setActiveRegion(region as RegionCode | null),
    setIsGeofenceActive,
    setGeofenceLocation,
    setGeofenceCoordinates,
    setFilterMode,
    regionOutline,
    mapInstance
  ]);

  // Combined loading state
  const combinedLoading = localLoading || mapLoading || false;

  // Add effect to fetch manufacturers on mount
 useEffect(() => {
  const fetchManufacturers = async () => {
    setIsLoadingManufacturers(true);
    try {
      const response = await fetch('/api/tracking/manufacturers');
      if (!response.ok) {
        throw new Error(`Failed to load manufacturers: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Fetched manufacturer data:', data);

      const processedData = data.manufacturers?.map((m: any) => ({
        manufacturer: m.name || 'Unknown', // <--- FIXED HERE
        count: typeof m.count === 'number' ? m.count : 0,
      })) || [];

      console.log('Processed manufacturer list:', processedData);

      setManufacturers(processedData);
    } catch (error) {
      console.error('Error loading manufacturers:', error);
    } finally {
      setIsLoadingManufacturers(false);
    }
  };
  fetchManufacturers();
}, []);



  // Effect to fetch model data when manufacturer changes
  useEffect(() => {
  const fetchModels = async () => {
    if (!selectedManufacturer) {
      setModelOptions(null);
      return;
    }
    
    try {
      const response = await fetch(`/api/tracking/models?manufacturer=${encodeURIComponent(selectedManufacturer)}`);
      if (!response.ok) {
        throw new Error(`Failed to load models: ${response.statusText}`);
      }
      const data = await response.json();
      const processedData = data.models?.map((m: any) => ({
        name: m.model || m.MODEL || 'Unknown',
        count: typeof m.count === 'number' ? m.count : 0,
      })) || [];
      setModelOptions(processedData);
    } catch (error) {
      console.error('Error loading models:', error);
    }
  };
  
  fetchModels();
}, [selectedManufacturer]);


  // Effect to handle map geofence click
  useEffect(() => {
    const handleMapGeofenceClick = async (event: Event) => {
      try {
        const customEvent = event as CustomEvent<{ lat: number; lng: number }>;
        const { lat, lng } = customEvent.detail;

        setGeofenceCoordinates({ lat, lng });
        setGeofenceLocation(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);

        try {
          const locationName = await MapboxService.getLocationNameFromCoordinates(
            lat,
            lng
          );
          if (locationName !== null) {
            setGeofenceLocation(locationName);
          }
        } catch (error) {
          console.error('Error getting location name:', error);
        }

        if (activeDropdown !== 'location') {
          setActiveDropdown('location');
        }
      } catch (error) {
        console.error('Error handling map click:', error);
      }
    };

    document.addEventListener(
      'map-geofence-click',
      handleMapGeofenceClick as EventListener
    );

    return () => {
      document.removeEventListener(
        'map-geofence-click',
        handleMapGeofenceClick as EventListener
      );
    };
  }, [activeDropdown, setGeofenceCoordinates, setGeofenceLocation, setActiveDropdown]);

  return {
    modelOptions: modelOptions, // Add the modelOptions property
    models: modelOptions || [], // Ensure models property is included and defaults to an empty array
    // State
    filterMode,
    activeDropdown,
    selectedManufacturer,
    selectedModel,
    geofenceLocation,
    geofenceRadius,
    regionCounts,
    isGeofenceActive,
    geofenceCoordinates,
    activeRegion: activeRegionState,
    ownerFilters,
    allOwnerTypes,
    manufacturerSearchTerm,
    isGettingLocation,
    dropdownRefs,
    localLoading,
    isRateLimited,
    selectedRegion,
    isRefreshing,
    isGeofencePlacementMode,
    lastUpdated,
    quotaUsage,
    notification,
    showLiveData,
    isLoading: combinedLoading,
    totalActive,
    combinedLoading,
    
    // Data
    manufacturers,
    // Removed 'models' as it is not declared or initialized

    
    // Methods
    refreshWithFilters,
    toggleDropdown,
    toggleFilterMode,
    selectManufacturerAndClose,
    handleModelSelect,
    setActiveRegion,
    processGeofenceSearch,
    handleOwnerFilterChange,
    handleRegionSelect,
    handleManufacturerSelect,
    setManufacturerSearchTerm,
    setGeofenceLocation,
    setGeofenceRadius,
    toggleGeofenceState,
    clearAllFilters,
    setGeofenceCoordinates,
    setGeofenceCenter,
    setIsGettingLocation,
    updateGeofenceAircraft: mapUpdateGeofenceAircraft || ((aircraft: any[]) => {}),
    getUserLocation,
    setActiveDropdown,
    applyFilters,
    setIsGeofencePlacementMode,
    
    // State setters
    setSelectedManufacturer,
    setFilterMode,
    toggleGeofenceActive,
    setIsGeofenceLocationMode: (mode: boolean) => setIsGeofencePlacementMode(mode),
    setSelectedModel,
    setOwnerFilters,
    setIsGeofenceActive,
  };
}