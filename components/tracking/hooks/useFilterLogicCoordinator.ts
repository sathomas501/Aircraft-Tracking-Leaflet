// hooks/useFilterLogicCoordinator.ts
import { useState, useRef, useEffect, useCallback } from 'react';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import { useManufacturerFilterLogic } from './useManufacturerFilterLogic';
import { useGeofenceFilterLogic } from './useGeofenceFilterLogic';
import { useOwnerFilterLogic } from './useOwnerFilterLogic';
import { useRegionFilterLogic } from './useRegionFilterLogic';
import { RegionCode, ExtendedAircraft } from '@/types/base';
import { MapboxService } from '../../../lib/services/MapboxService';

export type FilterMode = 'manufacturer' | 'geofence' | 'both' | 'owner' | 'region';

interface Coordinates {
  lat: number;
  lng: number;
}

interface PanelPosition {
  x: number;
  y: number;
}

export function useFilterLogicCoordinator() {
  // Get the map context
  const mapContext = useEnhancedMapContext();
  
  // UI state
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode | null>(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [rateLimitTimer, setRateLimitTimer] = useState<number | null>(null);
  
  // Geofence Panel state
  const [showGeofencePanel, setShowGeofencePanel] = useState<boolean>(false);
  const [geofencePanelPosition, setGeofencePanelPosition] = useState<PanelPosition | null>(null);
  const [tempCoordinates, setTempCoordinates] = useState<Coordinates | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState<boolean>(false);
  const [hasError, setHasError] = useState<string | null>(null);
  
  // Create dropdown refs
  const dropdownRefs = {
    filter: useRef<HTMLDivElement>(null),
    manufacturer: useRef<HTMLDivElement>(null),
    model: useRef<HTMLDivElement>(null),
    location: useRef<HTMLDivElement>(null),
    region: useRef<HTMLDivElement>(null),
    owner: useRef<HTMLDivElement>(null),
    actions: useRef<HTMLDivElement>(null),
  };
  
  // Initialize the individual filter hooks
  const manufacturerLogic = useManufacturerFilterLogic({
    activeDropdown,
    setActiveDropdown
  });

  const regionLogic = useRegionFilterLogic({
    mapInstance: mapContext.mapInstance,
    clearGeofenceData: mapContext.clearGeofenceData,
    activeDropdown,
    setActiveDropdown,
    updateGeofenceAircraft: mapContext.updateGeofenceAircraft,
    displayedAircraft: mapContext.displayedAircraft
  });
  
  // Initialize geofence logic with ability to handle errors
  const geofenceLogic = useGeofenceFilterLogic({
    activeDropdown,
    setActiveDropdown,
    onError: setHasError
  });
  
  const ownerLogic = useOwnerFilterLogic({
    activeDropdown,
    setActiveDropdown,
    displayedAircraft: mapContext.displayedAircraft,
    updateGeofenceAircraft: mapContext.updateGeofenceAircraft,
    clearGeofenceData: mapContext.clearGeofenceData
  });
  
  // Toggle dropdown method
  const toggleDropdown = (dropdown: string, event: React.MouseEvent) => {
    if (activeDropdown === dropdown) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown(dropdown);
    }
    // Prevent events from bubbling up
    event.stopPropagation();
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside of all dropdowns
      const isOutsideAll = Object.values(dropdownRefs).every(
        (ref) => !ref.current || !ref.current.contains(event.target as Node)
      );
      
      if (isOutsideAll) {
        setActiveDropdown(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Method to toggle filter mode
  const toggleFilterMode = (mode: FilterMode) => {
    setFilterMode(mode);
    setActiveDropdown(null);
    
    // Implement mode-specific logic based on your original implementation
    if (mode === 'region') {
      // Apply region filtering logic
    } else if (mode === 'owner') {
      // Apply owner filtering logic
    } else if (mode === 'both') {
      // Apply combined filtering logic
    }
  };
  
  // Apply combined filters
  const applyCombinedFilters = () => {
    if (
      !manufacturerLogic.selectedManufacturer ||
      !geofenceLogic.isGeofenceActive ||
      geofenceLogic.geofenceAircraft.length === 0
    ) {
      return;
    }
    
    setLocalLoading(true);
    
    try {
      // Filter logic based on your original implementation
      console.log('Applying combined filters...');
      
      // Implement the rest of your combined filter logic here
      
    } catch (error) {
      console.error('Error applying combined filters:', error);
      setHasError('Error applying combined filters');
    } finally {
      setLocalLoading(false);
    }
  };
  
  // Method to clear all filters
  const clearAllFilters = () => {
    console.log('Clearing all filters...');
    
    // Reset filter mode
    setFilterMode('manufacturer');
    
    // Reset manufacturer filters
    mapContext.selectManufacturer(null);
    mapContext.selectModel(null);
    
    // Reset geofence
    geofenceLogic.setGeofenceLocation('');
    geofenceLogic.setGeofenceCoordinates(null);
    if (typeof mapContext.clearGeofence === 'function') {
      mapContext.clearGeofence();
    }
    if (typeof mapContext.clearGeofenceData === 'function') {
      mapContext.clearGeofenceData();
    }
    
    // Reset owner filters
    
    // Reset map view
    if (mapContext.mapInstance) {
      // Reset view based on your original implementation
    }
    
    // Close any open dropdown
    setActiveDropdown(null);
    
    // Reset panel state
    setShowGeofencePanel(false);
    setGeofencePanelPosition(null);
    setTempCoordinates(null);
    setLocationName(null);
    setHasError(null);
    
    // Dispatch the event
    const clearEvent = new CustomEvent('ribbon-filters-cleared');
    document.dispatchEvent(clearEvent);
    
    console.log('All filters cleared successfully');
  };

  // Geofence Panel functions
  const openGeofencePanel = useCallback((position: PanelPosition) => {
    setGeofencePanelPosition(position);
    setShowGeofencePanel(true);
  }, []);

  const closeGeofencePanel = useCallback(() => {
    setShowGeofencePanel(false);
    setGeofencePanelPosition(null);
  }, []);

  const resetGeofencePanel = useCallback(() => {
    setTempCoordinates(null);
    setLocationName(null);
    closeGeofencePanel();
  }, [closeGeofencePanel]);

  const handlePanelSearch = useCallback(async (lat: number, lng: number) => {
    if (!lat || !lng) return;
    
    setLocalLoading(true);
    setHasError(null);
    
    try {
      // Update temp coordinates
      setTempCoordinates({ lat, lng });
      
      // Get location name from coordinates
      setIsLoadingLocation(true);
      const name = await MapboxService.getLocationNameFromCoordinates(lat, lng);
      setLocationName(name);
      
      // Set geofence coordinates
      geofenceLogic.setGeofenceCoordinates({ lat, lng });
      
      // Set geofence center if available
      if (typeof geofenceLogic.setGeofenceCenter === 'function') {
        geofenceLogic.setGeofenceCenter({ lat, lng });
      }
      
      // Process search
      await geofenceLogic.processGeofenceSearch(true);
      
      // Close panel after search
      closeGeofencePanel();
    } catch (error: any) {
      console.error('Error in panel search:', error);
      setHasError(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    } finally {
      setLocalLoading(false);
      setIsLoadingLocation(false);
    }
  }, [geofenceLogic, closeGeofencePanel]);

  // Calculate combined loading state
  const combinedLoading = localLoading || 
    manufacturerLogic.localLoading || 
    geofenceLogic.localLoading;
  
  return {
    // UI state
    activeDropdown,
    filterMode,
    dropdownRefs,
    hasError,
    
    // UI methods
    toggleDropdown,
    setActiveDropdown,
    
    // Region filter properties
    activeRegion: regionLogic.activeRegion,
    handleRegionSelect: regionLogic.handleRegionSelect,

    // Filter mode methods
    toggleFilterMode,
    applyCombinedFilters,
    clearAllFilters,
    
    // Combined state
    combinedLoading,
    isRateLimited,
    rateLimitTimer,
    
    // Manufacturer filter
    selectedManufacturer: manufacturerLogic.selectedManufacturer,
    selectedModel: manufacturerLogic.selectedModel,
    manufacturerSearchTerm: manufacturerLogic.manufacturerSearchTerm,
    selectManufacturerAndClose: manufacturerLogic.selectManufacturerAndClose,
    handleModelSelect: manufacturerLogic.handleModelSelect,
    setManufacturerSearchTerm: manufacturerLogic.setManufacturerSearchTerm,
    
    // Geofence filter
    geofenceLocation: geofenceLogic.geofenceLocation,
    geofenceRadius: geofenceLogic.geofenceRadius,
    isGeofenceActive: geofenceLogic.isGeofenceActive,
    geofenceCoordinates: geofenceLogic.geofenceCoordinates,
    isGettingLocation: geofenceLogic.isGettingLocation,
    getUserLocation: geofenceLogic.getUserLocation,
    processGeofenceSearch: geofenceLogic.processGeofenceSearch,
    toggleGeofenceState: geofenceLogic.toggleGeofenceState,
    setGeofenceLocation: geofenceLogic.setGeofenceLocation,
    setGeofenceRadius: geofenceLogic.setGeofenceRadius,
    setGeofenceCoordinates: geofenceLogic.setGeofenceCoordinates,
    setGeofenceCenter: geofenceLogic.setGeofenceCenter,
    setIsGettingLocation: geofenceLogic.setIsGettingLocation,
    geofenceAircraft: geofenceLogic.geofenceAircraft,
    clearGeofenceData: geofenceLogic.clearGeofenceData,
    
    // Panel state
    showGeofencePanel,
    geofencePanelPosition,
    tempCoordinates,
    locationName,
    isLoadingLocation,
    
    // Panel methods
    setShowGeofencePanel,
    setGeofencePanelPosition,
    setTempCoordinates,
    setLocationName,
    openGeofencePanel,
    closeGeofencePanel,
    resetGeofencePanel,
    handlePanelSearch,
    
    // Owner filter
    ownerFilters: ownerLogic.ownerFilters,
    allOwnerTypes: ownerLogic.allOwnerTypes,
    handleOwnerFilterChange: ownerLogic.handleOwnerFilterChange,
    getAircraftOwnerType: ownerLogic.getAircraftOwnerType,
    
    // Additional properties for backward compatibility
    isGeofencePlacementMode: false,
    
    // MapContext pass-through
    updateGeofenceAircraft: mapContext.updateGeofenceAircraft,
    selectedRegion: mapContext.selectedRegion,
    refreshWithFilters: () => {
      if (typeof mapContext.refreshPositions === 'function') {
        mapContext.refreshPositions().catch((error: unknown) => {
          console.error('Error refreshing positions:', error);
          setHasError('Error refreshing positions');
        });
      }
    },
  };
}