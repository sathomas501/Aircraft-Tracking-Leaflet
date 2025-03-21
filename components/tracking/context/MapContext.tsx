// components/tracking/context/MapContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
} from 'react';
import type { ReactNode } from 'react';
import type { Aircraft, ExtendedAircraft } from '@/types/base';
import type { Map as LeafletMap } from 'leaflet';
import openSkyTrackingService from '@/lib/services/openSkyTrackingService';

// Define the context type
interface MapContextType {
  // Map state
  mapInstance: LeafletMap | null;
  setMapInstance: (map: LeafletMap | null) => void;
  selectedAircraft: ExtendedAircraft | null;
  setSelectedAircraft: (aircraft: ExtendedAircraft | null) => void;
  zoomLevel: number;
  setZoomLevel: (zoom: number) => void;
  isLoading: boolean;
  isRefreshing: boolean;
  preserveView: boolean;
  lastRefreshed: string | null;
  aircraft: Aircraft[];

  // Actions
  refreshPositions: () => Promise<void>;
  fullRefresh: () => Promise<void>;
  selectAircraft: (aircraft: ExtendedAircraft | null) => void; // Add this
}

// Create the context with undefined default value
const MapContext = createContext<MapContextType | undefined>(undefined);

// Provider component
export const MapProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // Core map state
  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null);
  const [selectedAircraft, setSelectedAircraft] =
    useState<ExtendedAircraft | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(9); // Default zoom level
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [preserveView, setPreserveView] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);

  // Method to refresh positions only
  const refreshPositions = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    setPreserveView(true); // Set flag to preserve the current view

    try {
      // Call the service method for position-only refresh
      if (typeof openSkyTrackingService.refreshPositionsOnly === 'function') {
        await openSkyTrackingService.refreshPositionsOnly();
      } else {
        // Fallback to regular refresh
        await openSkyTrackingService.refreshNow();
      }

      // Update last refreshed timestamp
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Error refreshing positions:', error);
    } finally {
      setIsRefreshing(false);

      // Reset preserve view flag after a delay to ensure updates complete
      setTimeout(() => {
        setPreserveView(false);
      }, 500);
    }
  }, [isRefreshing]);

  // Method for full refresh
  const fullRefresh = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    setPreserveView(false); // Don't preserve view on full refresh

    try {
      await openSkyTrackingService.refreshNow();
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Error in full refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  // Method to select an aircraft
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

  // Combine all values and functions to be provided by the context
  const value: MapContextType = {
    mapInstance,
    setMapInstance,
    selectedAircraft,
    aircraft,
    setSelectedAircraft,
    zoomLevel,
    setZoomLevel,
    isLoading,
    isRefreshing,
    preserveView,
    lastRefreshed,
    refreshPositions,
    fullRefresh,
    selectAircraft, // Include the function we just defined
  };

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
};

// Custom hook to use the map context
export const useMapContext = () => {
  const context = useContext(MapContext);
  if (context === undefined) {
    throw new Error('useMapContext must be used within a MapProvider');
  }
  return context;
};

export default MapContext;
