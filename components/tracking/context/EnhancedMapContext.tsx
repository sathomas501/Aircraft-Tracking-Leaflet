// components/tracking/context/EnhancedMapContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import L from 'leaflet';
import {
  SelectOption,
  ExtendedAircraft,
  AircraftPosition,
  RegionCode,
} from '@/types/base';
import type { CachedAircraftData } from '@/types/base'; // Import your new type
import type { AircraftModel } from '../../../types/aircraft-models';
import openSkyTrackingService from '@/lib/services/openSkyTrackingService';
import {
  saveAircraftData,
  loadAircraftData,
  mergeAircraftData,
  clearAircraftData,
} from '../persistence/AircraftDataPersistence';
import type { LatLngBoundsExpression } from 'leaflet';
import {
  MAP_CONFIG,
  getBoundsByRegion as configGetBoundsByRegion,
} from '../../../config/map';

// Define context interface
interface EnhancedMapContextType {
  // Map state
  mapInstance: L.Map | null;
  setMapInstance: (map: L.Map | null) => void;
  zoomLevel: number;
  setZoomLevel: (zoom: number) => void;

  // Aircraft data
  displayedAircraft: ExtendedAircraft[];
  selectedAircraft: ExtendedAircraft | null;
  selectAircraft: (aircraft: ExtendedAircraft | null) => void;

  // Data persistence
  cachedAircraftData: Record<string, CachedAircraftData>;
  updateAircraftData: (newAircraft: ExtendedAircraft[]) => void;
  lastPersistenceUpdate: number | null;

  // Selection state
  selectedManufacturer: string | null;
  selectedModel: string | null;
  activeModels: AircraftModel[];
  totalActive: number;

  // Loading state
  isLoading: boolean;
  isRefreshing: boolean;
  trackingStatus: string;
  lastRefreshed: string | null;

  // Actions
  selectManufacturer: (MANUFACTURER: string | null) => Promise<void>;
  selectModel: (MODEL: string | null) => void;
  reset: () => Promise<void>;
  refreshPanel: () => void;
  refreshPositions: () => Promise<void>;
  fullRefresh: () => Promise<void>;
  clearCache: () => void;
  clearGeofenceData: () => void;
  // Add new function for updating aircraft from geofence
  updateGeofenceAircraft: (geofenceAircraft: ExtendedAircraft[]) => void;

  filterMode: 'manufacturer' | 'geofence' | 'both' | 'region' | 'owner';
  setFilterMode: (
    mode: 'manufacturer' | 'geofence' | 'both' | 'region' | 'owner'
  ) => void;
  blockManufacturerApiCalls: boolean;
  setBlockManufacturerApiCalls: (block: boolean) => void;
  isManufacturerApiBlocked: boolean;
  setIsManufacturerApiBlocked: (blocked: boolean) => void;
  filteredAircraft: ExtendedAircraft[];

  // Geofencing properties
  geofenceCenter: { lat: number; lng: number } | null; // Correctly typed as { lat: number; lng: number } | null
  geofenceRadius: number | null; // in kilometers
  isGeofenceActive: boolean;
  setGeofenceCenter: (center: { lat: number; lng: number } | null) => void;
  setGeofenceRadius: (radius: number | null) => void;
  toggleGeofence: () => void;
  clearGeofence: () => {};
  geofenceCoordinates: { lat: number; lng: number } | null;
  isGeofencePlacementMode: boolean;
  setIsGeofencePlacementMode: (isPlacementMode: boolean) => void;

  // Region selection properties
  selectedRegion: RegionCode | string; // Allow both for backward compatibility
  setSelectedRegion: (region: RegionCode | string) => void;
  getBoundsByRegion: (region: string) => LatLngBoundsExpression;
}

// Create context with default values
const EnhancedMapContext = createContext<EnhancedMapContextType>({
  mapInstance: null,
  setMapInstance: () => {},
  zoomLevel: 6,
  setZoomLevel: () => {},
  displayedAircraft: [],
  selectedAircraft: null,
  selectAircraft: () => {},

  // Data persistence defaults
  cachedAircraftData: {},
  updateAircraftData: () => {},
  lastPersistenceUpdate: null,

  selectedManufacturer: null,
  selectedModel: null,
  activeModels: [],
  totalActive: 0,

  isLoading: false,
  isRefreshing: false,
  trackingStatus: '',
  lastRefreshed: null,

  selectManufacturer: async () => {},
  selectModel: () => {},
  refreshPanel: () => {},
  // Reset function to clear all selections and data
  reset: async () => {},
  refreshPositions: async () => {},
  fullRefresh: async () => {},
  clearCache: () => {},
  clearGeofenceData: () => {},
  // Add default for new function
  updateGeofenceAircraft: () => {},

  filterMode: 'manufacturer',
  setFilterMode: () => {},
  blockManufacturerApiCalls: false,
  setBlockManufacturerApiCalls: () => {},
  isManufacturerApiBlocked: false,
  setIsManufacturerApiBlocked: () => {},

  // Geofencing properties
  geofenceCenter: null,
  geofenceRadius: 25, // Default to 25km, not null
  isGeofenceActive: false,
  setGeofenceCenter: () => {},
  setGeofenceRadius: () => {},
  geofenceCoordinates: null,
  toggleGeofence: () => {},
  clearGeofence: () => ({}),
  filteredAircraft: [],
  selectedRegion: RegionCode.GLOBAL,
  setSelectedRegion: (region: RegionCode | string) => {},
  getBoundsByRegion: (region: string) =>
    configGetBoundsByRegion('GLOBAL') as LatLngBoundsExpression,
  isGeofencePlacementMode: false,
  setIsGeofencePlacementMode: () => {},
});

// Props for the context provider
interface EnhancedMapProviderProps {
  children: React.ReactNode;
  manufacturers: SelectOption[];
  onError: (message: string) => void;
}

// Enhanced Map Provider component
export const EnhancedMapProvider: React.FC<EnhancedMapProviderProps> = ({
  children,
  manufacturers,
  onError,
}) => {
  // Map state
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(6);

  // Aircraft state
  const [displayedAircraft, setDisplayedAircraft] = useState<
    ExtendedAircraft[]
  >([]);
  const [selectedAircraft, setSelectedAircraft] =
    useState<ExtendedAircraft | null>(null);

  // Data persistence state
  const [cachedAircraftData, setCachedAircraftData] = useState<
    Record<string, CachedAircraftData>
  >({});
  const [lastPersistenceUpdate, setLastPersistenceUpdate] = useState<
    number | null
  >(null);

  const [geofenceCenter, setGeofenceCenter] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [selectedRegion, setSelectedRegion] = useState<RegionCode | string>(
    RegionCode.GLOBAL
  );

  // Derived state for geofence coordinates
  const geofenceCoordinates = useMemo(() => geofenceCenter, [geofenceCenter]);
  const [geofenceRadius, setGeofenceRadius] = useState<number | null>(25); // Default 25km radius
  const [isGeofenceActive, setIsGeofenceActive] = useState<boolean>(false);
  const [isGeofencePlacementMode, setIsGeofencePlacementMode] =
    useState<boolean>(false);

  // Add this to your state declarations
  const [aircraftPositions, setAircraftPositions] = useState<
    AircraftPosition[]
  >([]);
  // Toggle geofence activation
  const toggleGeofence = useCallback(() => {
    setIsGeofenceActive((prev) => !prev);
  }, []);

  // Clear geofence
  const clearGeofence = useCallback(() => {
    setGeofenceCenter(null);
    setIsGeofenceActive(false);
    return {}; // Return an empty object to match the expected type
  }, []);

  // Selection state
  const [selectedManufacturer, setSelectedManufacturer] = useState<
    string | null
  >(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [activeModels, setActiveModels] = useState<AircraftModel[]>([]);
  const [totalActive, setTotalActive] = useState<number>(0);

  // Loading state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [trackingStatus, setTrackingStatus] = useState<string>('');
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  // Add this with your other state variables
  const [lastFullRefreshTime, setLastFullRefreshTime] = useState<number | null>(
    null
  );
  const [isManufacturerApiBlocked, setIsManufacturerApiBlocked] =
    useState<boolean>(false);

  const [filterMode, setFilterMode] = useState<
    'manufacturer' | 'geofence' | 'both' | 'region' | 'owner'
  >('manufacturer');
  const [blockManufacturerApiCalls, setBlockManufacturerApiCalls] =
    useState<boolean>(false);

  // Flag to track if we're in geofence mode
  const [isGeofenceMode, setIsGeofenceMode] = useState<boolean>(false);

  // Define the filter function correctly
  const filterAircraftByGeofence = useCallback(() => {
    if (!geofenceCenter || !isGeofenceActive) {
      return displayedAircraft;
    }

    // Helper function to calculate distance between two points
    const calculateDistance = (
      lat1: number,
      lon1: number,
      lat2: number,
      lon2: number
    ): number => {
      const R = 6371; // Radius of the earth in km
      const dLat = deg2rad(lat2 - lat1);
      const dLon = deg2rad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) *
          Math.cos(deg2rad(lat2)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c; // Distance in km
      return distance;
    };

    const deg2rad = (deg: number): number => {
      return deg * (Math.PI / 180);
    };

    // Filter aircraft within the radius
    return displayedAircraft.filter((aircraft) => {
      if (!aircraft.latitude || !aircraft.longitude) return false;

      // Calculate distance between aircraft and geofence center
      const distance = calculateDistance(
        geofenceCenter.lat,
        geofenceCenter.lng,
        aircraft.latitude,
        aircraft.longitude
      );

      // Return true if aircraft is within radius
      return geofenceRadius !== null && distance <= geofenceRadius;
    });
  }, [displayedAircraft, geofenceCenter, geofenceRadius, isGeofenceActive]);

  // Then separately, define filteredAircraft - don't try to do both in the same function
  const filteredAircraft = useMemo(() => {
    return isGeofenceActive && geofenceCenter
      ? filterAircraftByGeofence()
      : displayedAircraft;
  }, [
    isGeofenceActive,
    geofenceCenter,
    filterAircraftByGeofence,
    displayedAircraft,
  ]);

  // Refs for tracking subscriptions
  const unsubscribeAircraftRef = useRef<(() => void) | null>(null);
  const unsubscribeStatusRef = useRef<(() => void) | null>(null);
  // Load persisted aircraft data on mount
  useEffect(() => {
    const savedData = loadAircraftData();
    if (savedData) {
      console.log(
        `[EnhancedMapContext] Loaded ${Object.keys(savedData).length} aircraft from persistence`
      );
      setCachedAircraftData(savedData);
      setLastPersistenceUpdate(Date.now());
    }
  }, []);

  // Save aircraft data when cachedAircraftData changes
  useEffect(() => {
    if (Object.keys(cachedAircraftData).length > 0) {
      console.log(
        `[EnhancedMapContext] Saving ${Object.keys(cachedAircraftData).length} aircraft to persistence`
      );
      saveAircraftData(cachedAircraftData);
    }
  }, [cachedAircraftData]);

  // Initialize tracking service and subscriptions
  useEffect(() => {
    // Subscribe to tracking updates that include trail data
    const handleTrackingUpdate = (data: any) => {
      // Only update displayed aircraft if we're not in geofence mode
      if (!isGeofenceMode) {
        updateAircraftDisplay();
      }
    };

    // Subscribe to aircraft updates
    unsubscribeAircraftRef.current =
      openSkyTrackingService.subscribe(handleTrackingUpdate);

    // Subscribe to status updates
    unsubscribeStatusRef.current = openSkyTrackingService.subscribeToStatus(
      (status: string) => {
        setTrackingStatus(status);
        setIsLoading(openSkyTrackingService.isLoading());
      }
    );

    // IMPORTANT: Clear any existing tracking when component mounts
    openSkyTrackingService.stopTracking();

    // Cleanup on unmount
    return () => {
      if (unsubscribeAircraftRef.current) {
        unsubscribeAircraftRef.current();
      }
      if (unsubscribeStatusRef.current) {
        unsubscribeStatusRef.current();
      }
    };
  }, [isGeofenceMode]);

  // Update aircraft data with persistence
  const updateAircraftData = useCallback(
    (newAircraftArray: ExtendedAircraft[]) => {
      // Convert to a map for easier processing
      const newAircraftMap: Record<string, CachedAircraftData> = {};

      newAircraftArray.forEach((aircraft) => {
        if (aircraft.ICAO24) {
          newAircraftMap[aircraft.ICAO24] = {
            ...aircraft,
            // Ensure required fields for CachedAircraftData are present
            ICAO24: aircraft.ICAO24,
            latitude: aircraft.latitude || 0,
            longitude: aircraft.longitude || 0,
            altitude: aircraft.altitude || 0,
            velocity: aircraft.velocity || 0,
            heading: aircraft.heading || 0,
            on_ground: aircraft.on_ground || false,
            last_contact: aircraft.last_contact || Date.now(),
            lastSeen: Date.now(),
            lastUpdated: Date.now(),
          } as CachedAircraftData;
        }
      });

      // Merge with existing cached data to preserve fields
      setCachedAircraftData((currentCache) =>
        mergeAircraftData(currentCache, newAircraftMap)
      );
      setLastPersistenceUpdate(Date.now());

      // If the selected aircraft is updated, update the selection
      if (selectedAircraft && newAircraftMap[selectedAircraft.ICAO24]) {
        const updatedAircraft = {
          ...selectedAircraft,
          ...newAircraftMap[selectedAircraft.ICAO24],
        };
        setSelectedAircraft(updatedAircraft as ExtendedAircraft);
      }
    },
    [selectedAircraft]
  );

  // Clear persistence cache
  const clearCache = useCallback(() => {
    clearAircraftData();
    setCachedAircraftData({});
    setLastPersistenceUpdate(null);
    setTrackingStatus('Cache cleared');
  }, []);

  // Update aircraft display based on selected MODEL
  const updateAircraftDisplay = useCallback(() => {
    // Get extended aircraft based on selected MODEL
    const extendedAircraft = openSkyTrackingService.getExtendedAircraft(
      selectedModel || undefined
    );

    // Get MODEL stats from the service
    const { models, totalActive: total } =
      openSkyTrackingService.getModelStats();

    // Enhance aircraft data with persistence
    updateAircraftData(extendedAircraft as ExtendedAircraft[]);

    // Only update displayed aircraft if we're not in geofence mode
    if (!isGeofenceMode) {
      setDisplayedAircraft(extendedAircraft as ExtendedAircraft[]);
      setActiveModels(models);
      setTotalActive(total);
    }

    setIsLoading(openSkyTrackingService.isLoading());
  }, [selectedModel, updateAircraftData, isGeofenceMode]);

  // Update display when MODEL selection changes
  useEffect(() => {
    updateAircraftDisplay();
  }, [selectedModel, updateAircraftDisplay]);

  // New function to handle geofence aircraft updates
  const updateGeofenceAircraft = useCallback(
    (geofenceAircraft: ExtendedAircraft[]) => {
      // Mark that we're in geofence mode
      setIsGeofenceMode(true);

      console.log(
        `[EnhancedMapContext] Updating ${geofenceAircraft.length} aircraft from geofence`
      );

      // Update the cached data (same as regular updates)
      updateAircraftData(geofenceAircraft);

      // Also directly update the displayed aircraft
      setDisplayedAircraft(geofenceAircraft);

      // Update stats
      setTotalActive(geofenceAircraft.length);

      // Extract MODEL stats for the sidebar
      const modelCounts = geofenceAircraft.reduce(
        (acc, aircraft) => {
          const MODEL = aircraft.MODEL || aircraft.TYPE_AIRCRAFT || 'Unknown';
          if (!acc[MODEL]) {
            acc[MODEL] = {
              MODEL,
              count: 0,
              MANUFACTURER: aircraft.MANUFACTURER || 'Unknown',
              // Add required properties for AircraftModel
              label: MODEL,
              activeCount: 0,
              totalCount: 0,
            };
          }
          acc[MODEL].count++;
          acc[MODEL].activeCount++;
          acc[MODEL].totalCount++;
          return acc;
        },
        {} as Record<string, AircraftModel>
      );

      // Convert to array for the activeModels state
      const modelArray = Object.values(modelCounts).map((MODEL) => ({
        MODEL: MODEL.MODEL,
        count: MODEL.count,
        MANUFACTURER: MODEL.MANUFACTURER,
        // Add required properties for AircraftModel type
        label: MODEL.MODEL,
        activeCount: MODEL.count,
        totalCount: MODEL.count,
      }));

      setActiveModels(modelArray);

      // Update the last refreshed timestamp
      setLastRefreshed(new Date().toLocaleTimeString());
    },
    [updateAircraftData]
  );

  // Handle MANUFACTURER selection
  // In your EnhancedMapContext.tsx - modify the selectManufacturer function

  const selectManufacturer = async (MANUFACTURER: string | null) => {
    // Exit geofence mode when selecting a MANUFACTURER
    setIsGeofenceMode(false);
    setSelectedManufacturer(MANUFACTURER);
    setSelectedModel(null);
    setIsLoading(true);
    setLastRefreshed(null);

    // Clear previous data
    setDisplayedAircraft([]);
    setActiveModels([]);
    setTotalActive(0);

    // If null, just exit
    if (MANUFACTURER === null) {
      setIsLoading(false);
      return;
    }

    // If we're blocking API calls, exit early
    if (isManufacturerApiBlocked) {
      console.log(
        `[EnhancedMapContext] API calls blocked for manufacturer: ${MANUFACTURER}`
      );
      setIsLoading(false);
      return;
    }

    try {
      // Start tracking with a progress handler
      setTrackingStatus(`Loading aircraft for ${MANUFACTURER}...`);

      // Use the existing service but with a progress callback
      // In EnhancedMapContext.tsx, modify your callback to handle both types:

      await openSkyTrackingService.trackManufacturerWithProgress(
        MANUFACTURER,
        (progress) => {
          // Update the tracking status message
          if (progress.message) {
            setTrackingStatus(progress.message);
          }

          // Update displayed aircraft as they're loaded
          if (progress.aircraft) {
            // Cast the aircraft array to ExtendedAircraft[] since our context uses that type
            setDisplayedAircraft(progress.aircraft as ExtendedAircraft[]);
          }

          // Update model stats
          if (progress.models) {
            setActiveModels(progress.models);
          }

          // Update total count
          if (progress.total !== undefined) {
            setTotalActive(progress.total);
          }
        }
      );

      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (error) {
      onError(
        `Error tracking manufacturer: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      setTrackingStatus('Error loading aircraft data');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle MODEL selection
  const selectModel = (MODEL: string | null) => {
    setSelectedModel(MODEL);
  };

  // Handle aircraft selection
  const selectAircraft = (aircraft: ExtendedAircraft | null) => {
    setSelectedAircraft(aircraft);

    // If selecting an aircraft, check if we have cached data to enhance it
    if (aircraft && aircraft.ICAO24 && cachedAircraftData[aircraft.ICAO24]) {
      const enhancedAircraft = {
        ...aircraft,
        ...cachedAircraftData[aircraft.ICAO24],
      };
      setSelectedAircraft(enhancedAircraft as ExtendedAircraft);
    }
  };

  // If you don't already have it, add this function to expose the map's getBoundsByRegion function
  // Create a wrapped function that calls your map config function
  const handleGetBoundsByRegion = useCallback(
    (region: string): LatLngBoundsExpression => {
      return configGetBoundsByRegion(region);
    },
    []
  );

  // Reset all selections
  const reset = async () => {
    await selectManufacturer(null);
  };

  // Method to refresh only the positions of active aircraft
  const refreshPositions = async () => {
    if (isRefreshing || (!selectedManufacturer && !isGeofenceMode)) return;

    setIsRefreshing(true);
    setTrackingStatus('Updating aircraft positions...');

    try {
      // Call the service
      await openSkyTrackingService.refreshPositionsOnly();

      setLastRefreshed(new Date().toLocaleTimeString());
      setTrackingStatus(
        `Positions updated for ${displayedAircraft.length} aircraft`
      );
    } catch (error) {
      onError(
        `Error refreshing positions: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 500);
    }
  };

  // Method for full tracking refresh
  const fullRefresh = async () => {
    if ((!selectedManufacturer && !isGeofenceMode) || isRefreshing) return;

    // Set a timeout to force exit from loading state after 10 seconds
    // This is a safety mechanism
    const safetyTimeout = setTimeout(() => {
      setIsRefreshing(false);
      setTrackingStatus('Refresh timed out');
    }, 10000);

    setIsRefreshing(true);

    try {
      // Get currently tracked aircraft
      const allTrackedAircraft = openSkyTrackingService.getTrackedAircraft();

      // Get active aircraft (those with position data)
      const activeAircraft = allTrackedAircraft.filter(
        (aircraft) => aircraft.ICAO24 && aircraft.latitude && aircraft.longitude
      );

      const needsFullRefresh =
        !lastFullRefreshTime || Date.now() - lastFullRefreshTime > 3600000;

      let success = false;

      if (activeAircraft.length === 0 || needsFullRefresh) {
        // Do a full refresh
        setTrackingStatus('Performing full refresh...');

        try {
          await openSkyTrackingService.refreshNow();
          setLastFullRefreshTime(Date.now());
          success = true;
        } catch (error) {
          // Silently handle this error
          console.warn('Full refresh failed');
        }
      } else {
        // Do an optimized refresh
        const activeIcaos = activeAircraft
          .map((aircraft) => aircraft.ICAO24)
          .filter(Boolean) as string[];

        if (activeIcaos.length > 0) {
          setTrackingStatus(
            `Refreshing ${activeIcaos.length} active aircraft...`
          );

          try {
            await openSkyTrackingService.refreshSpecificAircraft(activeIcaos);
            success = true;
          } catch (error) {
            // Try falling back to a full refresh
            console.warn('Optimized refresh failed, trying full refresh');
            try {
              await openSkyTrackingService.refreshNow();
              setLastFullRefreshTime(Date.now());
              success = true;
            } catch (fallbackError) {
              // Silently handle this error
              console.warn('Fallback refresh failed');
            }
          }
        }
      }

      clearTimeout(safetyTimeout);

      // Only update if the refresh was successful
      if (success) {
        const currentCount = openSkyTrackingService.getTrackedAircraft().length;
        setTrackingStatus(`Refresh completed with ${currentCount} aircraft`);
        setLastRefreshed(new Date().toLocaleTimeString());
      } else {
        setTrackingStatus('Refresh failed');
      }
    } catch (error) {
      clearTimeout(safetyTimeout);

      // Only show errors to the user if they appear to be significant
      if (error instanceof Error && error.message !== 'aborted') {
        onError(`Error during refresh: ${error.message || 'Unknown error'}`);
      }

      setTrackingStatus('Error during refresh');
    } finally {
      clearTimeout(safetyTimeout);
      setIsRefreshing(false);
    }
  };

  const clearGeofenceData = useCallback(() => {
    // Reset geofence mode flag
    setIsGeofenceMode(false);

    // Clear displayed aircraft
    setDisplayedAircraft([]);
    setActiveModels([]);
    setTotalActive(0);

    // If there was a previously selected MANUFACTURER, we can restore it
    if (selectedManufacturer) {
      // Small delay to ensure state updates properly
      setTimeout(() => {
        openSkyTrackingService.trackManufacturer(selectedManufacturer);
      }, 100);
    }
  }, [selectedManufacturer]);

  // Create context value
  const contextValue: EnhancedMapContextType = {
    mapInstance,
    setMapInstance,
    zoomLevel,
    setZoomLevel,

    displayedAircraft,
    selectedAircraft,
    selectAircraft,

    // Data persistence
    cachedAircraftData,
    updateAircraftData,
    lastPersistenceUpdate,

    selectedManufacturer,
    selectedModel,
    activeModels,
    totalActive,

    isLoading,
    isRefreshing,
    trackingStatus,
    lastRefreshed,

    selectManufacturer,
    selectModel,
    reset,
    refreshPanel: () => {
      console.warn('refreshPanel is not implemented yet.');
    },
    refreshPositions,
    fullRefresh,
    clearCache,
    clearGeofenceData,
    updateGeofenceAircraft,
    filteredAircraft,

    filterMode,
    setFilterMode,
    blockManufacturerApiCalls,
    setBlockManufacturerApiCalls,
    isManufacturerApiBlocked,
    setIsManufacturerApiBlocked,

    // Geofencing properties
    geofenceCenter,
    geofenceRadius,
    isGeofenceActive,
    geofenceCoordinates,
    setGeofenceCenter,
    setGeofenceRadius,
    toggleGeofence,
    clearGeofence,
    isGeofencePlacementMode,
    setIsGeofencePlacementMode,

    // Region selection
    selectedRegion,
    setSelectedRegion,
    getBoundsByRegion: handleGetBoundsByRegion,
  };

  return (
    <EnhancedMapContext.Provider value={contextValue}>
      {children}
    </EnhancedMapContext.Provider>
  );
};

// Custom hook to use the context
export const useEnhancedMapContext = () => useContext(EnhancedMapContext);

export default EnhancedMapContext;
