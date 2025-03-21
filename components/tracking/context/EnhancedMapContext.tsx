// components/tracking/context/EnhancedMapContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import type { ReactNode } from 'react';
import type { ExtendedAircraft } from '@/types/base';
import type { Map as LeafletMap } from 'leaflet';
import type { SelectOption } from '@/types/base';
import type { AircraftModel } from '@/types/aircraft-models';
import openSkyTrackingService from '@/lib/services/openSkyTrackingService';

// Define the context type
interface EnhancedMapContextType {
  // Map state
  mapInstance: LeafletMap | null;
  setMapInstance: (map: LeafletMap | null) => void;
  selectedAircraft: ExtendedAircraft | null;
  zoomLevel: number;
  isLoading: boolean;
  isRefreshing: boolean;
  preserveView: boolean;
  lastRefreshed: string | null;

  // Selection state
  selectedManufacturer: string | null;
  selectedModel: string | null;
  displayedAircraft: ExtendedAircraft[];
  activeModels: AircraftModel[];
  totalActive: number;
  trackingStatus: string;

  // Actions
  selectAircraft: (aircraft: ExtendedAircraft | null) => void;
  refreshPositions: () => Promise<void>;
  fullRefresh: () => Promise<void>;
  selectManufacturer: (manufacturer: string | null) => Promise<void>;
  selectModel: (model: string | null) => void;
  reset: () => Promise<void>;
}

// Create the context
const EnhancedMapContext = createContext<EnhancedMapContextType | undefined>(
  undefined
);

// Provider component
interface EnhancedMapProviderProps {
  children: ReactNode;
  manufacturers: SelectOption[];
  onError: (message: string) => void;
}

export const EnhancedMapProvider: React.FC<EnhancedMapProviderProps> = ({
  children,
  manufacturers,
  onError,
}) => {
  // Map state
  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null);
  const [selectedAircraft, setSelectedAircraft] =
    useState<ExtendedAircraft | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(9);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [preserveView, setPreserveView] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);

  // Selection state
  const [selectedManufacturer, setSelectedManufacturer] = useState<
    string | null
  >(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [displayedAircraft, setDisplayedAircraft] = useState<
    ExtendedAircraft[]
  >([]);
  const [activeModels, setActiveModels] = useState<AircraftModel[]>([]);
  const [totalActive, setTotalActive] = useState<number>(0);
  const [trackingStatus, setTrackingStatus] = useState<string>('');

  // ID to track refresh operations
  const [currentRefreshId, setCurrentRefreshId] = useState<number | null>(null);

  // Subscribe to aircraft updates from service
  useEffect(() => {
    const unsubscribeAircraft = openSkyTrackingService.subscribeToAircraft(
      () => {
        updateAircraftDisplay();
      }
    );

    const unsubscribeStatus = openSkyTrackingService.subscribeToStatus(
      (status) => {
        setTrackingStatus(status);
        setIsLoading(openSkyTrackingService.isLoading());
      }
    );

    return () => {
      if (unsubscribeAircraft) unsubscribeAircraft();
      if (unsubscribeStatus) unsubscribeStatus();
    };
  }, []);

  // Update aircraft display based on model filter
  const updateAircraftDisplay = useCallback(() => {
    // Get extended aircraft based on selected model
    const aircraft = openSkyTrackingService.getExtendedAircraft(
      selectedModel || undefined
    );

    // Get model stats from the service
    const { models, totalActive } = openSkyTrackingService.getModelStats();

    setDisplayedAircraft(aircraft);
    setActiveModels(models);
    setTotalActive(totalActive);
    setIsLoading(openSkyTrackingService.isLoading());
  }, [selectedModel]);

  // Select aircraft
  const selectAircraft = useCallback(
    (aircraft: ExtendedAircraft | null) => {
      setSelectedAircraft(aircraft);

      // If map exists and aircraft has position, pan to it
      if (mapInstance && aircraft?.latitude && aircraft?.longitude) {
        mapInstance.panTo([aircraft.latitude, aircraft.longitude]);
      }
    },
    [mapInstance]
  );

  // Select manufacturer
  const selectManufacturer = useCallback(
    async (manufacturer: string | null) => {
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
    },
    [onError]
  );

  // Select model
  const selectModel = useCallback(
    (model: string | null) => {
      setSelectedModel(model);
      updateAircraftDisplay();
    },
    [updateAircraftDisplay]
  );

  // Reset selection
  const reset = useCallback(async () => {
    await selectManufacturer(null);
  }, [selectManufacturer]);

  // Refresh positions
  const refreshPositions = useCallback(async () => {
    if (!selectedManufacturer || isRefreshing) {
      console.log(
        '[EnhancedMapContext] Refresh skipped - already refreshing or no manufacturer selected'
      );
      return;
    }

    console.log('[EnhancedMapContext] Starting position refresh');

    // Set a unique ID for this refresh operation
    const refreshId = Date.now();
    setCurrentRefreshId(refreshId);

    setIsRefreshing(true);
    setPreserveView(true);
    setTrackingStatus('Updating aircraft positions...');

    // Disable map bounds fitting
    const originalFitBounds = mapInstance?.fitBounds;
    if (mapInstance) {
      mapInstance.fitBounds = function () {
        console.log('fitBounds disabled during refresh');
        return this;
      };
    }

    try {
      console.log('[EnhancedMapContext] Calling service refresh method');

      // Call the service method
      if (typeof openSkyTrackingService.refreshPositionsOnly === 'function') {
        await openSkyTrackingService.refreshPositionsOnly();
      } else {
        await openSkyTrackingService.refreshNow();
      }

      // Only update state if this is still the current refresh operation
      if (currentRefreshId === refreshId) {
        console.log('[EnhancedMapContext] Refresh completed successfully');
        setLastRefreshed(new Date().toLocaleTimeString());
        setTrackingStatus(
          `${displayedAircraft.length} aircraft tracked, positions updated`
        );
      } else {
        console.log('[EnhancedMapContext] Refresh superseded by newer refresh');
      }
    } catch (error) {
      console.error('[EnhancedMapContext] Refresh error:', error);
      onError(
        `Error refreshing positions: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      // Only reset state if this is still the current refresh
      if (currentRefreshId === refreshId) {
        console.log('[EnhancedMapContext] Resetting refresh state');

        // Restore original fitBounds with a delay
        setTimeout(() => {
          if (mapInstance && originalFitBounds) {
            console.log('[EnhancedMapContext] Restoring fitBounds');
            mapInstance.fitBounds = originalFitBounds;
          }
        }, 2000);

        // Reset the refreshing state
        setIsRefreshing(false);

        // Reset preserve view flag after a delay
        setTimeout(() => {
          setPreserveView(false);
        }, 500);
      }
    }
  }, [
    currentRefreshId,
    displayedAircraft.length,
    isRefreshing,
    mapInstance,
    onError,
    selectedManufacturer,
  ]);

  // Full refresh
  const fullRefresh = useCallback(async () => {
    if (!selectedManufacturer || isRefreshing) return;

    setIsRefreshing(true);
    setPreserveView(false);
    setTrackingStatus('Performing full refresh...');

    try {
      await openSkyTrackingService.refreshNow();
      setLastRefreshed(new Date().toLocaleTimeString());
      setTrackingStatus(
        `Full refresh completed with ${displayedAircraft.length} aircraft`
      );
    } catch (error) {
      onError(
        `Error during full refresh: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [displayedAircraft.length, isRefreshing, onError, selectedManufacturer]);

  // Combine all values and functions to be provided by the context
  const value: EnhancedMapContextType = {
    // Map state
    mapInstance,
    setMapInstance,
    selectedAircraft,
    zoomLevel,
    isLoading,
    isRefreshing,
    preserveView,
    lastRefreshed,

    // Selection state
    selectedManufacturer,
    selectedModel,
    displayedAircraft,
    activeModels,
    totalActive,
    trackingStatus,

    // Actions
    selectAircraft,
    refreshPositions,
    fullRefresh,
    selectManufacturer,
    selectModel,
    reset,
  };

  // Listen for map zoom changes
  useEffect(() => {
    if (!mapInstance) return;

    const handleZoom = () => {
      setZoomLevel(mapInstance.getZoom());
    };

    mapInstance.on('zoomend', handleZoom);
    setZoomLevel(mapInstance.getZoom());

    return () => {
      mapInstance.off('zoomend', handleZoom);
    };
  }, [mapInstance]);

  return (
    <EnhancedMapContext.Provider value={value}>
      {children}
    </EnhancedMapContext.Provider>
  );
};

// Custom hook to use the map context
export const useEnhancedMapContext = () => {
  const context = useContext(EnhancedMapContext);
  if (context === undefined) {
    throw new Error(
      'useEnhancedMapContext must be used within an EnhancedMapProvider'
    );
  }
  return context;
};

export default EnhancedMapContext;
