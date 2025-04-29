// hooks/useGeofencePanel.ts
import { useState, useEffect } from 'react';
import { ExtendedAircraft } from '@/types/base';
import { MapboxService } from '../../../lib/services/MapboxService';

// Define the shape of panel coordinates
interface PanelPosition {
  x: number;
  y: number;
}

// Define the shape of geofence coordinates
interface Coordinates {
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
  updateGeofenceAircraft: (aircraft: ExtendedAircraft[]) => void;
  setGeofenceCenter?: (coords: Coordinates) => void;
  setGeofenceCoordinates?: (coords: Coordinates | null) => void;
  processGeofenceSearch?: (fromPanel?: boolean) => Promise<void> | void;
  setCoordinates?: (coords: PanelPosition) => void;
  setShowPanel?: (show: boolean) => void;
}

export function useGeofencePanel(options: GeofencePanelOptions) {
  // Panel state
  const [showPanel, setShowPanel] = useState<boolean>(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const [tempCoordinates, setTempCoordinates] = useState<Coordinates | null>(null);
  
  // Geofence state
  const [locationName, setLocationName] = useState<string | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [geofenceLocation, setGeofenceLocation] = useState<string>('');

  // Open panel at specific position
  const openPanel = (position: PanelPosition) => {
    setPanelPosition(position);
    setShowPanel(true);
    
    // Pass to parent if handler provided
    if (options.setShowPanel) {
      options.setShowPanel(true);
    }
  };

  // Close panel
  const closePanel = () => {
    setShowPanel(false);
    setPanelPosition(null);
    
    // Pass to parent if handler provided
    if (options.setShowPanel) {
      options.setShowPanel(false);
    }
  };

  // Reset panel state
  const resetPanel = () => {
    setTempCoordinates(null);
    setLocationName(null);
    setGeofenceLocation('');
    closePanel();
  };

  // Handle search from panel
  const handlePanelSearch = async (lat: number, lng: number) => {
    if (!lat || !lng) return;
    
    setIsSearching(true);
    try {
      // Update temp coordinates
      setTempCoordinates({ lat, lng });
      
      // Get location name from coordinates
      setIsLoadingLocation(true);
      const name = await MapboxService.getLocationNameFromCoordinates(lat, lng);
      setLocationName(name);
      
      // Set geofence coordinates if available
      if (options.setGeofenceCoordinates) {
        options.setGeofenceCoordinates({ lat, lng });
      }
      
      // Set geofence center if available
      if (options.setGeofenceCenter) {
        options.setGeofenceCenter({ lat, lng });
      }
      
      // Process search if available
      if (options.processGeofenceSearch) {
        await options.processGeofenceSearch(true);
      }
      
      // Close panel after search
      closePanel();
    } catch (error) {
      console.error('Error in panel search:', error);
    } finally {
      setIsSearching(false);
      setIsLoadingLocation(false);
    }
  };

  // Update panel position and notify parent
  const updatePanelPosition = (position: PanelPosition) => {
    setPanelPosition(position);
    
    // Pass to parent if handler provided
    if (options.setCoordinates) {
      options.setCoordinates(position);
    }
  };

  return {
    // State
    showPanel,
    panelPosition,
    tempCoordinates,
    locationName,
    isLoadingLocation,
    isSearching,
    geofenceLocation,
    
    // Setters
    setShowPanel,
    setPanelPosition: updatePanelPosition,
    setTempCoordinates,
    setLocationName,
    setGeofenceLocation,
    
    // Methods
    openPanel,
    closePanel,
    resetPanel,
    handlePanelSearch,
  };
}