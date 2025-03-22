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

  // Actions
  selectManufacturer: (manufacturer: string | null) => Promise<void>;
  selectModel: (model: string | null) => void;
  reset: () => Promise<void>;
  refreshPositions: () => Promise<void>;
  fullRefresh: () => Promise<void>;
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

  selectManufacturer: async () => {},
  selectModel: () => {},
  reset: async () => {},
  refreshPositions: async () => {},
  fullRefresh: async () => {},
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

  // Refs for tracking subscriptions
  const unsubscribeAircraftRef = useRef<(() => void) | null>(null);
  const unsubscribeStatusRef = useRef<(() => void) | null>(null);

  // Initialize tracking service and subscriptions
  // In the EnhancedMapContext.tsx file, modify the useEffect to use stopTracking:

  useEffect(() => {
    // Subscribe to aircraft updates
    unsubscribeAircraftRef.current = openSkyTrackingService.subscribeToAircraft(
      () => {
        updateAircraftDisplay();
      }
    );

    // Subscribe to status updates
    unsubscribeStatusRef.current = openSkyTrackingService.subscribeToStatus(
      (status: string) => {
        setTrackingStatus(status);
        setIsLoading(openSkyTrackingService.isLoading());
      }
    );

    // IMPORTANT: Add this to clear any existing tracking when component mounts
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

    setIsRefreshing(true);
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
  };

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

    selectManufacturer,
    selectModel,
    reset,
    refreshPositions,
    fullRefresh,
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
