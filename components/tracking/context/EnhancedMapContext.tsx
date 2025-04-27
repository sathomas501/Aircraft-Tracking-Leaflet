// components/tracking/context/EnhancedMapContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import L from 'leaflet';
import {
  SelectOption,
  ExtendedAircraft,
  AircraftPosition,
  RegionCode,
} from '@/types/base';
import type { CachedAircraftData } from '@/types/base';
import type { AircraftModel } from '../../../types/aircraft-models';
import openSkyTrackingService from '@/lib/services/openSkyTrackingService';
import {
  saveAircraftData,
  loadAircraftData,
  mergeAircraftData,
  clearAircraftData,
} from '../persistence/AircraftDataPersistence';
import type { LatLngBoundsExpression } from 'leaflet';

// Define context interface
export interface EnhancedMapContextType {
  // Map state
  mapInstance: L.Map | null;
  setMapInstance: (map: L.Map | null) => void;
  zoomLevel: number;
  setZoomLevel: (zoom: number) => void;

  geofenceCenter: { lat: number; lng: number } | null;
  geofenceRadius: number | null;
  isGeofenceActive: boolean;
  clearGeofence: () => void;
  setGeofenceRadius: (radius: number | null) => void;
  toggleGeofence: () => void;
  geofenceCoordinates: [number, number][] | null;
  isGeofencePlacementMode: boolean;
  setIsGeofencePlacementMode: (active: boolean) => void;
  selectedRegion: number;
  reset: () => void;

  // Aircraft data
  displayedAircraft: ExtendedAircraft[];
  selectedAircraft: ExtendedAircraft | null;
  selectAircraft: (aircraft: ExtendedAircraft | null) => void;

  // Data persistence
  cachedAircraftData: Record<string, CachedAircraftData>;
  updateAircraftData: (newAircraft: ExtendedAircraft[]) => void;
  lastPersistenceUpdate: number | null;

  // Model data
  activeModels: AircraftModel[];
  totalActive: number;

  manufacturers?: Array<{ value: string; label: string }>;

  // Loading state
  isLoading: boolean;
  isRefreshing: boolean;
  trackingStatus: string;
  lastRefreshed: string | null;

  // Actions
  loadManufacturerData: (manufacturer: string | null) => Promise<void>;
  refreshPanel: () => void;
  refreshPositions: () => Promise<void>;
  fullRefresh: () => Promise<void>;
  clearCache: () => void;

  // Geofence actions
  updateGeofenceAircraft: (geofenceAircraft: ExtendedAircraft[]) => void;
  clearGeofenceData: () => void;

  // Region helpers
  GLOBAL_BOUNDS: (region: string) => LatLngBoundsExpression;
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
  geofenceCenter: null, // Fix type
  geofenceRadius: 25,
  isGeofenceActive: false,
  clearGeofence: () => {},
  setGeofenceRadius: () => {},
  toggleGeofence: () => {},
  geofenceCoordinates: null,
  isGeofencePlacementMode: false, // Added
  setIsGeofencePlacementMode: () => {}, // Added
  selectedRegion: 0, // Added, using proper RegionCode.GLOBAL value
  reset: () => {}, // Added
  // Data persistence defaults
  cachedAircraftData: {},
  updateAircraftData: () => {},
  lastPersistenceUpdate: null,
  activeModels: [],
  totalActive: 0,
  isLoading: false,
  isRefreshing: false,
  trackingStatus: '',
  lastRefreshed: null,
  loadManufacturerData: async () => {},
  refreshPanel: () => {},
  refreshPositions: async () => {},
  fullRefresh: async () => {},
  clearCache: () => {},
  updateGeofenceAircraft: () => {},
  clearGeofenceData: () => {},
  GLOBAL_BOUNDS: (region: string) => {
    console.warn('GLOBAL_BOUNDS is not implemented yet.');
    return [
      [0, 0],
      [0, 0],
    ] as LatLngBoundsExpression; // Default bounds
  },
  getBoundsByRegion: (region: string) => {
    console.warn('getBoundsByRegion is not implemented yet.');
    return [
      [0, 0],
      [0, 0],
    ] as LatLngBoundsExpression; // Default bounds
  },
});

// Props for the context provider
export interface EnhancedMapProviderProps {
  children: React.ReactNode;
  manufacturers?: Array<{ value: string; label: string }>;
  onError?: (message: string) => void;
}

// Enhanced Map Provider component
export const EnhancedMapProvider: React.FC<EnhancedMapProviderProps> = ({
  children,
  onError = (message: string) => console.error(message),
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

  // Add this to your state declarations
  const [aircraftPositions, setAircraftPositions] = useState<
    AircraftPosition[]
  >([]);

  // Loading state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [trackingStatus, setTrackingStatus] = useState<string>('');
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [lastFullRefreshTime, setLastFullRefreshTime] = useState<number | null>(
    null
  );

  // Model stats
  const [activeModels, setActiveModels] = useState<AircraftModel[]>([]);
  const [totalActive, setTotalActive] = useState<number>(0);

  // Flag to track if we're in geofence mode
  const [isGeofenceMode, setIsGeofenceMode] = useState<boolean>(false);

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
    // Subscribe to tracking updates
    const handleTrackingUpdate = () => {
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

  // Update aircraft display based on model
  const updateAircraftDisplay = useCallback(
    (model?: string) => {
      // Get extended aircraft based on model
      const extendedAircraft =
        openSkyTrackingService.getExtendedAircraft(model);

      // Get model stats from the service
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
    },
    [updateAircraftData, isGeofenceMode]
  );

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

      // Extract model stats for the sidebar
      const modelCounts = geofenceAircraft.reduce(
        (acc, aircraft) => {
          const model = aircraft.MODEL || aircraft.TYPE_AIRCRAFT || 'Unknown';
          if (!acc[model]) {
            acc[model] = {
              MODEL: model,
              count: 0,
              MANUFACTURER: aircraft.MANUFACTURER || 'Unknown',
              // Add required properties for AircraftModel
              label: model,
              activeCount: 0,
              totalCount: 0,
            };
          }
          acc[model].count++;
          acc[model].activeCount++;
          acc[model].totalCount++;
          return acc;
        },
        {} as Record<string, AircraftModel>
      );

      // Convert to array for the activeModels state
      const modelArray = Object.values(modelCounts).map((model) => ({
        MODEL: model.MODEL,
        count: model.count,
        MANUFACTURER: model.MANUFACTURER,
        // Add required properties for AircraftModel type
        label: model.MODEL,
        activeCount: model.count,
        totalCount: model.count,
      }));

      setActiveModels(modelArray);

      // Update the last refreshed timestamp
      setLastRefreshed(new Date().toLocaleTimeString());
    },
    [updateAircraftData]
  );

  // Load manufacturer data - replaces selectManufacturer
  const loadManufacturerData = async (manufacturer: string | null) => {
    // Exit geofence mode when selecting a manufacturer
    setIsGeofenceMode(false);
    setIsLoading(true);
    setLastRefreshed(null);

    // Clear previous data
    setDisplayedAircraft([]);
    setActiveModels([]);
    setTotalActive(0);

    // If null, just exit
    if (manufacturer === null) {
      setIsLoading(false);
      return;
    }

    try {
      // Start tracking with a progress handler
      setTrackingStatus(`Loading aircraft for ${manufacturer}...`);

      await openSkyTrackingService.trackManufacturerWithProgress(
        manufacturer,
        (progress) => {
          // Update the tracking status message
          if (progress.message) {
            setTrackingStatus(progress.message);
          }

          // Update displayed aircraft as they're loaded
          if (progress.aircraft) {
            // Cast the aircraft array to ExtendedAircraft[]
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

  // Create a wrapped function that calls your map config function
  const handleGetBoundsByRegion = useCallback(
    (region: string): LatLngBoundsExpression => {
      return getBoundsByRegion(region);
    },
    []
  );

  // Method to refresh only the positions of active aircraft
  const refreshPositions = async () => {
    if (isRefreshing) return;

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
    if (isRefreshing) return;

    // Set a timeout to force exit from loading state after 10 seconds
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
  }, []);

  // Create context value
  const contextValue: EnhancedMapContextType = {
    mapInstance,
    setMapInstance,
    zoomLevel,
    setZoomLevel,

    isGeofencePlacementMode: false, // Default value for isGeofencePlacementMode
    setIsGeofencePlacementMode: (active: boolean) => {
      console.warn('setIsGeofencePlacementMode is not implemented yet.');
    },
    selectedRegion: 0, // Default value for selectedRegion
    reset: () => {
      console.warn('reset is not implemented yet.');
    },
    GLOBAL_BOUNDS: (region: string) => {
      console.warn('GLOBAL_BOUNDS is not implemented yet.');
      return [
        [0, 0],
        [0, 0],
      ] as LatLngBoundsExpression; // Default bounds
    },

    geofenceCenter: null, // Default value for geofenceCenter
    geofenceRadius: 25, // Default value for geofenceRadius
    isGeofenceActive: false, // Default value for isGeofenceActive
    clearGeofence: () => {
      console.warn('clearGeofence is not implemented yet.');
    },
    setGeofenceRadius: (radius: number | null) => {
      console.warn('setGeofenceRadius is not implemented yet.');
    },
    toggleGeofence: () => {
      console.warn('toggleGeofence is not implemented yet.');
    },
    geofenceCoordinates: null, // Default value for geofenceCoordinates

    displayedAircraft,
    selectedAircraft,
    selectAircraft,

    // Data persistence
    cachedAircraftData,
    updateAircraftData,
    lastPersistenceUpdate,

    activeModels,
    totalActive,

    isLoading,
    isRefreshing,
    trackingStatus,
    lastRefreshed,

    loadManufacturerData,
    refreshPanel: () => {
      console.warn('refreshPanel is not implemented yet.');
    },
    refreshPositions,
    fullRefresh,
    clearCache,
    clearGeofenceData,
    updateGeofenceAircraft,

    // Region selection helper
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
function getBoundsByRegion(region: string): L.LatLngBoundsExpression {
  throw new Error('Function not implemented.');
}
