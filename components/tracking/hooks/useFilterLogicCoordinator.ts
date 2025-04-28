// hooks/useFilterLogicCoordinator.ts
import { useState, useRef, useEffect } from 'react';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import { useManufacturerFilterLogic } from './useManufacturerFilterLogic';
import { useGeofenceFilterLogic } from './useGeofenceFilterLogic';
import { useOwnerFilterLogic } from './useOwnerFilterLogic';
import { useRegionFilterLogic } from './useRegionFilterLogic';
import { RegionCode, ExtendedAircraft } from '@/types/base';

export type FilterMode = 'manufacturer' | 'geofence' | 'both' | 'owner' | 'region';

export function useFilterLogicCoordinator() {
  // Get the map context
  const mapContext = useEnhancedMapContext();
  
  // UI state
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode | null>(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
    const [locationName, setLocationName] = useState<string | null>(null);
  const [rateLimitTimer, setRateLimitTimer] = useState<number | null>(null);
const [isRefreshing, setIsRefreshing] = useState(false);
const { updateGeofenceAircraft } = mapContext;
  
  // Create dropdown refs
  const dropdownRefs = {
    filter: useRef<HTMLDivElement>(null),
    manufacturer: useRef<HTMLDivElement>(null),
    model: useRef<HTMLDivElement>(null),
    location: useRef<HTMLDivElement>(null),
    region: useRef<HTMLDivElement>(null),
    owner: useRef<HTMLDivElement>(null),
    actions: useRef<HTMLDivElement>(null),
    state:useRef<HTMLDivElement>(null),
  };
  
  // Initialize the individual filter hooks
  const manufacturerLogic = useManufacturerFilterLogic({
    activeDropdown,
    setActiveDropdown
  });
  
  const geofenceLogic = useGeofenceFilterLogic({
    activeDropdown,
    setActiveDropdown
  });

  const regionLogic = useRegionFilterLogic(
    mapContext.mapInstance,
    mapContext.updateGeofenceAircraft,
    mapContext.clearGeofenceData,
    mapContext.displayedAircraft
  );

  
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
    
    // Dispatch the event
    const clearEvent = new CustomEvent('ribbon-filters-cleared');
    document.dispatchEvent(clearEvent);
    
    console.log('All filters cleared successfully');
  };
  
  // Calculate combined loading state
  const combinedLoading = localLoading || 
    manufacturerLogic.localLoading || 
    geofenceLogic.localLoading;
  
  return {
    // UI state
    activeDropdown,
    filterMode,
    dropdownRefs,
    activeRegion,
    isRefreshing,
    localLoading,
    
    // UI methods
    toggleDropdown,
    setActiveDropdown,
    
    // Filter mode methods
    toggleFilterMode,
    applyCombinedFilters,
    clearAllFilters,
    
    
    // Combined state
    combinedLoading,
    isRateLimited,
    rateLimitTimer,

 
    // Region filter properties

 
    updateGeofenceAircraft,
     handleRegionSelect: regionLogic.handleRegionSelect, // Make sure this is included
    
    
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
    setLocationName:geofenceLogic.setLocationName,
    
    
    // Owner filter
    ownerFilters: ownerLogic.ownerFilters,
    allOwnerTypes: ownerLogic.allOwnerTypes,
    handleOwnerFilterChange: ownerLogic.handleOwnerFilterChange,
    getAircraftOwnerType: ownerLogic.getAircraftOwnerType,
    
    // Additional properties for backward compatibility
    isGeofencePlacementMode: false,

    selectedRegion: mapContext.selectedRegion, // Or implement region filter logic
    refreshWithFilters: () => {
      if (typeof mapContext.refreshPositions === 'function') {
        mapContext.refreshPositions().catch((error: unknown) => {
          console.error('Error refreshing positions:', error);
        });
  }

  
}}}