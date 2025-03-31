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
import type {
  SelectOption,
  ExtendedAircraft,
  CachedAircraftData,
} from '../../../types/base';
import type { AircraftModel } from '../../../types/aircraft-models';
import openSkyTrackingService from '@/lib/services/openSkyTrackingService';
import {
  saveAircraftData,
  loadAircraftData,
  mergeAircraftData,
  clearAircraftData,
} from '../persistence/AircraftDataPersistence';
import {
  BaseTransforms,
  OpenSkyTransforms,
} from '../../../utils/aircraft-transform1';

// Define trail position interface
interface AircraftPosition {
  latitude: number;
  longitude: number;
  altitude: number | null;
  timestamp: number;
  debugTrailData: () => void;
  // Debug action
}

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

  // Trail state
  trailsEnabled: boolean;
  maxTrailLength: number;
  aircraftTrails: Map<string, AircraftPosition[]>;

  // Actions
  selectManufacturer: (manufacturer: string | null) => Promise<void>;
  selectModel: (model: string | null) => void;
  reset: () => Promise<void>;
  refreshPositions: () => Promise<void>;
  fullRefresh: () => Promise<void>;
  clearCache: () => void;

  // Trail actions
  toggleTrails: () => void;
  setMaxTrailLength: (length: number) => void;

  // Debug function
  debugTrailData: () => void;
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

  // Trail default values
  trailsEnabled: false,
  maxTrailLength: 10,
  aircraftTrails: new Map(),

  selectManufacturer: async () => {},
  selectModel: () => {},
  reset: async () => {},
  refreshPositions: async () => {},
  fullRefresh: async () => {},
  clearCache: () => {},

  // Trail actions
  toggleTrails: () => {},
  setMaxTrailLength: () => {},

  // Debug function
  debugTrailData: () => {},
});

// Props for the context provider
interface EnhancedMapProviderProps {
  children: React.ReactNode;
  manufacturers: SelectOption[];
  onError: (message: string) => void;
}

// Add these functions to your EnhancedMapContext.tsx file, above the EnhancedMapProvider component

/**
 * Normalizes aircraft data from different systems to work with your existing types
 * without requiring changes to the ExtendedAircraft interface
 */
function normalizeAircraft(aircraft: any): ExtendedAircraft {
  // First, ensure the aircraft has all required properties for ExtendedAircraft
  const normalizedAircraft: ExtendedAircraft = {
    ...aircraft,
    // Required properties from Aircraft
    icao24: aircraft.icao24 || '',
    'N-NUMBER': aircraft['N-NUMBER'] || '',
    manufacturer: aircraft.manufacturer || '',
    latitude: aircraft.latitude || aircraft.lat || 0,
    longitude: aircraft.longitude || aircraft.lng || 0,
    altitude: aircraft.altitude || 0,
    heading: aircraft.heading || 0,
    velocity: aircraft.velocity || 0,
    on_ground: aircraft.on_ground || false,
    last_contact:
      aircraft.last_contact ||
      aircraft.lastContact ||
      Math.floor(Date.now() / 1000),
    NAME: aircraft.NAME || '',
    CITY: aircraft.CITY || '',
    STATE: aircraft.STATE || '',
    OWNER_TYPE: aircraft.OWNER_TYPE || aircraft.ownerType || '',
    TYPE_AIRCRAFT:
      aircraft.TYPE_AIRCRAFT ||
      aircraft.type_aircraft ||
      aircraft.type ||
      'Unknown',
    isTracked: true,
    lastSeen: aircraft.lastSeen || Date.now(),

    // ExtendedAircraft specific properties
    type:
      aircraft.TYPE_AIRCRAFT ||
      aircraft.type_aircraft ||
      aircraft.type ||
      'Unknown',
    isGovernment:
      aircraft.OWNER_TYPE === 'Government' ||
      aircraft.ownerType === 'Government' ||
      false,
  };

  return normalizedAircraft;
}

/**
 * Normalize an array of aircraft
 */
function normalizeAircraftArray(aircraftArray: any[]): ExtendedAircraft[] {
  return aircraftArray.map(normalizeAircraft);
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

  // Trail state
  const [trailsEnabled, setTrailsEnabled] = useState<boolean>(false);
  const [maxTrailLength, setMaxTrailLength] = useState<number>(10);
  const [aircraftTrails, setAircraftTrails] = useState<
    Map<string, AircraftPosition[]>
  >(new Map());

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
      updateAircraftDisplay();

      // Update trail data if present
      if (data.trails) {
        setAircraftTrails(data.trails);
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

    // Initialize trail settings from service
    setTrailsEnabled(openSkyTrackingService.areTrailsEnabled());
    setMaxTrailLength(openSkyTrackingService.getMaxTrailLength());

    // Cleanup on unmount
    return () => {
      if (unsubscribeAircraftRef.current) {
        unsubscribeAircraftRef.current();
      }
      if (unsubscribeStatusRef.current) {
        unsubscribeStatusRef.current();
      }
    };
  }, []);

  // Update aircraft data with persistence
  const updateAircraftData = useCallback(
    (newAircraftArray: ExtendedAircraft[]) => {
      console.log(
        `[EnhancedMapContext] Updating with ${newAircraftArray.length} aircraft`
      );

      // Normalize aircraft data to ensure consistent format
      const normalizedAircraft = normalizeAircraftArray(newAircraftArray);

      if (normalizedAircraft.length > 0) {
        console.log(
          '[EnhancedMapContext] Sample normalized aircraft:',
          normalizedAircraft[0]
        );
      }

      // Convert to a map for easier processing
      const newAircraftMap: Record<string, CachedAircraftData> = {};

      normalizedAircraft.forEach((aircraft) => {
        if (aircraft.icao24) {
          // Use the normalized data which should have all required fields
          newAircraftMap[aircraft.icao24] = {
            ...aircraft,
            // Ensure required fields for CachedAircraftData are present
            icao24: aircraft.icao24,
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

      // Update displayed aircraft
      setDisplayedAircraft(normalizedAircraft);

      // If the selected aircraft is updated, update the selection
      if (selectedAircraft && newAircraftMap[selectedAircraft.icao24]) {
        const updatedAircraft = {
          ...selectedAircraft,
          ...newAircraftMap[selectedAircraft.icao24],
        };
        setSelectedAircraft(updatedAircraft);
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

  // In EnhancedMapContext.tsx, update the updateAircraftDisplay method:

  const updateAircraftDisplay = useCallback(() => {
    // Get extended aircraft based on selected model
    const extendedAircraft = openSkyTrackingService.getExtendedAircraft(
      selectedModel || undefined
    );

    // Get model stats from the service
    const { models, totalActive: total } =
      openSkyTrackingService.getModelStats();

    // Enhance aircraft data with persistence and ensure type compatibility
    const completeAircraft = extendedAircraft.map((aircraft) => {
      // Start with the original aircraft data
      const enhanced = { ...aircraft };

      // Set aircraft type using available properties, with fallbacks
      enhanced.type =
        aircraft.TYPE_AIRCRAFT || // Prefer uppercase version
        aircraft.TYPE_AIRCRAFT ||
        aircraft.type ||
        'unknown';

      // Set government status
      enhanced.isGovernment =
        aircraft.OWNER_TYPE === 'Government' ||
        aircraft.OWNER_TYPE === 'Government' ||
        false;

      // Ensure both coordinate formats exist
      if (typeof aircraft.latitude === 'number' && !isNaN(aircraft.latitude)) {
        enhanced.latitude = aircraft.latitude;
      }

      if (
        typeof aircraft.longitude === 'number' &&
        !isNaN(aircraft.longitude)
      ) {
        enhanced.longitude = aircraft.longitude;
      }

      // Use lat/lng as fallbacks for latitude/longitude if needed
      if (
        typeof aircraft.latitude === 'number' &&
        !isNaN(aircraft.latitude) &&
        (!enhanced.latitude || isNaN(enhanced.latitude))
      ) {
        enhanced.latitude = aircraft.latitude;
      }

      if (
        typeof aircraft.longitude === 'number' &&
        !isNaN(aircraft.longitude) &&
        (!enhanced.longitude || isNaN(enhanced.longitude))
      ) {
        enhanced.longitude = aircraft.longitude;
      }

      return enhanced;
    });

    console.log(
      `[EnhancedMapContext] Updating display with ${completeAircraft.length} aircraft`
    );

    // Update persistence and state
    updateAircraftData(completeAircraft);

    setActiveModels(models);
    setTotalActive(total);
    setIsLoading(openSkyTrackingService.isLoading());
  }, [selectedModel, updateAircraftData]);

  // Update display when model selection changes
  useEffect(() => {
    updateAircraftDisplay();
  }, [selectedModel, updateAircraftDisplay]);

  // Handle manufacturer selection
  const selectManufacturer = async (manufacturer: string | null) => {
    setSelectedManufacturer(manufacturer);
    setSelectedModel(null);
    setIsLoading(true);
    setLastRefreshed(null);

    try {
      // Track the new manufacturer, ensuring it's always a string
      await openSkyTrackingService.trackManufacturer(manufacturer ?? '');

      // Update the lastRefreshed timestamp after successful tracking
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (error) {
      onError(
        `Error tracking manufacturer: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle model selection
  const selectModel = (model: string | null) => {
    setSelectedModel(model);
  };

  // Handle aircraft selection
  const selectAircraft = (aircraft: ExtendedAircraft | null) => {
    setSelectedAircraft(aircraft);

    // If selecting an aircraft, check if we have cached data to enhance it
    if (aircraft && aircraft.icao24 && cachedAircraftData[aircraft.icao24]) {
      const enhancedAircraft = {
        ...aircraft,
        ...cachedAircraftData[aircraft.icao24],
      };
      setSelectedAircraft(enhancedAircraft);
    }
  };

  // Reset all selections
  const reset = async () => {
    await selectManufacturer(null);
  };

  // Method to refresh only the positions of active aircraft
  const refreshPositions = async () => {
    if (isRefreshing || !selectedManufacturer) return;

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
    if (!selectedManufacturer || isRefreshing) return;

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
        (aircraft) => aircraft.icao24 && aircraft.latitude && aircraft.longitude
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
          .map((aircraft) => aircraft.icao24)
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

  const debugTrailData = useCallback(() => {
    console.log('[MapContext] DEBUG - Current trail state:');
    console.log(`Trails enabled: ${trailsEnabled}`);
    console.log(`Max trail length: ${maxTrailLength}`);
    console.log(`Aircraft trails map size: ${aircraftTrails.size}`);

    if (aircraftTrails.size > 0) {
      console.log('Sample trail data:');
      const firstIcao = Array.from(aircraftTrails.keys())[0];
      const firstTrail = aircraftTrails.get(firstIcao);
      console.log(`Trail for ${firstIcao}: ${firstTrail?.length} positions`);
      console.log(firstTrail);
    }

    // Attempt to regenerate trails
    if (trailsEnabled) {
      openSkyTrackingService.generateMockTrails();
    }
  }, [trailsEnabled, maxTrailLength, aircraftTrails]);

  // Toggle trails on/off
  const toggleTrails = useCallback(() => {
    const newTrailsEnabled = !trailsEnabled;
    setTrailsEnabled(newTrailsEnabled);
    openSkyTrackingService.setTrailsEnabled(newTrailsEnabled);
  }, [trailsEnabled]);

  // Set maximum trail length
  const handleSetMaxTrailLength = useCallback((length: number) => {
    setMaxTrailLength(length);
    openSkyTrackingService.setMaxTrailLength(length);
  }, []);

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

    // Trail state
    trailsEnabled,
    maxTrailLength,
    aircraftTrails,

    selectManufacturer,
    selectModel,
    reset,
    refreshPositions,
    fullRefresh,
    clearCache,

    // Trail actions
    toggleTrails,
    setMaxTrailLength: handleSetMaxTrailLength,
    debugTrailData,
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
