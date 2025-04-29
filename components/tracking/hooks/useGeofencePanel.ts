// hooks/useGeofencePanel.ts
import { useState, useEffect, useCallback } from 'react';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import { MapboxService } from '../../../lib/services/MapboxService';

// Define the shape of panel coordinates
export interface PanelPosition {
  x: number;
  y: number;
}

// Define the shape of geofence coordinates
export interface Coordinates {
  lat: number;
  lng: number;
}

// Define the hook options
export interface GeofencePanelOptions {
  geofenceRadius: number;
  mapInstance: any; // Replace with your map type if available
  isGeofenceActive: boolean;
  toggleGeofenceState: (enabled: boolean) => void;
  setActiveDropdown: (dropdown: string | null) => void;
  updateGeofenceAircraft: (aircraft: any[]) => void;
  setGeofenceCenter?: (coords: Coordinates) => void;
  setGeofenceCoordinates?: (coords: Coordinates | null) => void;
  processGeofenceSearch?: (fromPanel?: boolean) => Promise<void> | void;
  setCoordinates?: (position: PanelPosition) => void;
  setShowPanel?: (show: boolean) => void;
  onClose?: () => void;
  onReset?: () => void;
}

export function useGeofencePanel(options: GeofencePanelOptions) {
  const {
    geofenceCenter,
    geofenceRadius,
    isGeofenceActive,
    setGeofenceCenter,
    setGeofenceRadius,
    toggleGeofence,
    clearGeofence,
    isLoading,
    trackingStatus,
  } = useEnhancedMapContext();
  
  // Local state
  const [showPanel, setShowPanel] = useState<boolean>(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const [tempCoordinates, setTempCoordinates] = useState<Coordinates | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState<boolean>(false);
  
  // Derived state
  const hasError = trackingStatus.includes('Error') ? trackingStatus : null;
  const isSearching = isLoading;

  // Effect to update temp coordinates when geofenceCenter changes
  useEffect(() => {
    if (geofenceCenter && (!tempCoordinates || 
        tempCoordinates.lat !== geofenceCenter.lat || 
        tempCoordinates.lng !== geofenceCenter.lng)) {
      setTempCoordinates(geofenceCenter);
      
      // Fetch location name
      fetchLocationName(geofenceCenter.lat, geofenceCenter.lng);
    }
  }, [geofenceCenter, tempCoordinates]);
  
  // Function to fetch location name
  const fetchLocationName = useCallback(async (lat: number, lng: number) => {
    setIsLoadingLocation(true);
    try {
      const name = await MapboxService.getLocationNameFromCoordinates(lat, lng);
      setLocationName(name);
    } catch (error) {
      console.error('Error getting location name:', error);
      setLocationName(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    } finally {
      setIsLoadingLocation(false);
    }
  }, []);

  // Open panel at specific position
  const openPanel = useCallback((position: PanelPosition, coordinates?: Coordinates) => {
    setPanelPosition(position);
    setShowPanel(true);
    
    if (coordinates) {
      setTempCoordinates(coordinates);
      fetchLocationName(coordinates.lat, coordinates.lng);
    }
  }, [fetchLocationName]);

  // Close panel
  const closePanel = useCallback(() => {
    setShowPanel(false);
    setPanelPosition(null);
    
    if (options?.onClose) {
      options.onClose();
    }
  }, [options]);

  // Reset panel and geofence
  const resetPanel = useCallback(() => {
    setShowPanel(false);
    setPanelPosition(null);
    setTempCoordinates(null);
    setLocationName(null);
    clearGeofence();
    
    if (options?.onReset) {
      options.onReset();
    }
  }, [clearGeofence, options]);

  // Process geofence search function with explicit type
  const processGeofenceSearch = useCallback((fromPanel: boolean = false): Promise<void> | void => {
    if (options.processGeofenceSearch) {
      return options.processGeofenceSearch(fromPanel);
    }
    
    // If no handler provided, at least log something
    console.log('processGeofenceSearch called but no handler provided in options');
    return Promise.resolve();
  }, [options]);

  // Search from panel
  const handlePanelSearch = useCallback((lat: number, lng: number) => {
    if (!lat || !lng) return;
    
    // Update geofence center and activate if needed
    setGeofenceCenter({ lat, lng });
    if (!isGeofenceActive) {
      toggleGeofence();
    }
    
    // Close panel
    closePanel();
  }, [setGeofenceCenter, isGeofenceActive, toggleGeofence, closePanel]);

  // Update panel position
  const updatePanelPosition = useCallback((position: PanelPosition) => {
    setPanelPosition(position);
  }, []);

  return {
    // State
    showPanel,
    panelPosition,
    tempCoordinates,
    locationName,
    isLoadingLocation,
    isSearching,
    hasError,
    geofenceRadius: geofenceRadius || 25,
    isGeofenceActive,
    
    // Setters
    setShowPanel,
    setPanelPosition: updatePanelPosition,
    setTempCoordinates,
    setLocationName,
    setGeofenceRadius,
    
    // Methods
    openPanel,
    closePanel,
    resetPanel,
    handlePanelSearch,
    processGeofenceSearch, // Added with explicit type
  };
}