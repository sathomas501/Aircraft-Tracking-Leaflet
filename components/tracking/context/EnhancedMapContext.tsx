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
import type { SelectOption, ExtendedAircraft } from '@/types/base';
import type { AircraftModel } from '../../../types/aircraft-models';
import openSkyTrackingService from '@/lib/services/openSkyTrackingService';

// Define trail position interface
interface AircraftPosition {
  latitude: number;
  longitude: number;
  altitude: number | null;
  timestamp: number;
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

  // Trail actions
  toggleTrails: () => void;
  setMaxTrailLength: (length: number) => void;
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

  // Trail actions
  toggleTrails: () => {},
  setMaxTrailLength: () => {},
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

  // Update aircraft display based on selected model
  const updateAircraftDisplay = useCallback(() => {
    // Get extended aircraft based on selected model
    const extendedAircraft = openSkyTrackingService.getExtendedAircraft(
      selectedModel || undefined
    );

    // Get model stats from the service
    const { models, totalActive: total } =
      openSkyTrackingService.getModelStats();

    setDisplayedAircraft(extendedAircraft);
    setActiveModels(models);
    setTotalActive(total);
    setIsLoading(openSkyTrackingService.isLoading());
  }, [selectedModel]);

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

    // Trail actions
    toggleTrails,
    setMaxTrailLength: handleSetMaxTrailLength,
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
