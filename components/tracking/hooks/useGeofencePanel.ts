// hooks/useGeofencePanel.ts
import { useState, useEffect, useCallback } from 'react';
import { MapboxService } from '../../../lib/services/MapboxService';
import { getAircraftNearLocation } from '../../../lib/services/geofencing';

interface Coordinates {
  lat: number;
  lng: number;
}

interface GeofencePanelOptions {
  geofenceRadius: number;
  setGeofenceLocation: (location: string) => void;
  setGeofenceCoordinates: (coordinates: Coordinates | null) => void;
  setGeofenceCenter: (coordinates: Coordinates) => void;
  updateGeofenceAircraft: (aircraft: any[]) => void;
  isGeofenceActive: boolean;
  processGeofenceSearch: () => void;
  toggleGeofenceState: (active: boolean) => void;
  setActiveDropdown: (dropdown: string | null) => void;
  clearGeofenceData?: () => void;
  setCoordinates: (coordinates: Coordinates | null) => void;
  setShowPanel: (show: boolean) => void;

  mapInstance: any;
}

export function useGeofencePanel(options: GeofencePanelOptions) {
  const {
    geofenceRadius,
    setGeofenceLocation,
    setGeofenceCoordinates,
    setGeofenceCenter,
    processGeofenceSearch,
    updateGeofenceAircraft,
    isGeofenceActive,
    toggleGeofenceState,
    clearGeofenceData,
    setActiveDropdown,
    setCoordinates,
    mapInstance,
  } = options;

  // Panel UI state
  const [panelPosition, setPanelPosition] = useState<
    { x: number; y: number } | undefined
  >({
    x: window.innerWidth - 340,
    y: 100,
  });

  const [showPanel, setShowPanel] = useState(false);
  const [tempCoordinates, setTempCoordinates] = useState<Coordinates | null>(
    null
  );
  const [isSearching, setIsSearching] = useState(false);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isLocalLoading, setLocalLoading] = useState(false); // Local loading state for geofence search
  const [activeDropdown] = useState<string | null>(null); // Active dropdown state
  // Default position for the panel - right side of screen

  // Panel control methods
  const openPanel = useCallback(() => {
    // Calculate position on right side of screen with some margin
    const rightPosition = window.innerWidth - 340; // 300px width + 40px margin
    const topPosition = 100; // 100px from top

    // Update panel position
    setPanelPosition({ x: rightPosition, y: topPosition });

    // Show the panel
    setShowPanel(true);

    // Close dropdown
    options.setActiveDropdown(null);

    // Dispatch event for map mode
    const event = new CustomEvent('enable-geofence-placement', {
      detail: { active: true },
    });
    document.dispatchEvent(event);
  }, [options.setActiveDropdown]);

  const closePanel = useCallback(() => {
    setShowPanel(false);
    setTempCoordinates(null);
    setLocationName(null);

    // Dispatch event to notify map that we're exiting geofence placement mode
    const event = new CustomEvent('enable-geofence-placement', {
      detail: { active: false },
    });
    document.dispatchEvent(event);
  }, []);

  // In your GeofenceFilter.tsx component
  const handleReset = () => {
    // Clear geofence data
    setGeofenceCoordinates(null);
    setGeofenceLocation('');

    // Reset geofence state
    if (isGeofenceActive) {
      toggleGeofenceState(false);
    }

    // Clear aircraft data if needed
    if (clearGeofenceData) {
      clearGeofenceData();
    }

    // Reset loading states
    setLocalLoading(false);

    // Keep dropdown open if needed
    if (activeDropdown === 'geofence') {
      // Don't close dropdown
    } else {
      setActiveDropdown(null);
    }
  };

  const resetPanel = useCallback(() => {
    // Clear UI state
    setTempCoordinates(null);
    setCoordinates(null);
    setLocationName(null);

    // Clear geofence system state
    setGeofenceCoordinates(null);
    setGeofenceLocation('');
    setLocationName(null); // optional fallback
    setGeofenceCenter?.({ lat: 0, lng: 0 }); // Reset to default coordinates

    // Clear any data drawn on the map
    if (clearGeofenceData) {
      clearGeofenceData();
    }

    // Deactivate geofence
    if (isGeofenceActive) {
      toggleGeofenceState(false);
    }

    // Reset UI flags
    setIsSearching(false);
    setLocalLoading(false);
    setShowPanel(true); // optional: keep open if needed
  }, [
    setTempCoordinates,
    setCoordinates,
    setLocationName,
    setGeofenceCoordinates,
    setGeofenceLocation,
    setGeofenceCenter,
    clearGeofenceData,
    isGeofenceActive,
    toggleGeofenceState,
    setIsSearching,
    setLocalLoading,
    setShowPanel,
  ]);

  // Make sure any panel action keeps the dropdown closed
  useEffect(() => {
    if (showPanel) {
      // Keep dropdown closed while panel is open
      options.setActiveDropdown(null);
    }
  }, [showPanel, options.setActiveDropdown]);

  // Fetch location name whenever coordinates change
  useEffect(() => {
    if (!tempCoordinates) return;

    setIsLoadingLocation(true);

    MapboxService.getLocationNameFromCoordinates(
      tempCoordinates.lat,
      tempCoordinates.lng
    )
      .then((name) => {
        setLocationName(name);
      })
      .catch((error) => {
        console.error('Error fetching location name:', error);
      })
      .finally(() => {
        setIsLoadingLocation(false);
      });
  }, [tempCoordinates]);

  // Handle search from panel
  const handlePanelSearch = useCallback(
    async (lat: number, lng: number) => {
      if (!lat || !lng || isSearching) return;

      setIsSearching(true);
      try {
        // Get location name
        const locationName = await MapboxService.getLocationNameFromCoordinates(
          lat,
          lng
        );

        // Set location in filter logic
        if (locationName) {
          setGeofenceLocation(locationName);
        } else {
          // Fallback to coordinates if no name found
          setGeofenceLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }

        // Update coordinates
        setGeofenceCoordinates({ lat, lng });
        setGeofenceCenter({ lat, lng });

        // Get aircraft data near this location
        const fetchedAircraft = await getAircraftNearLocation(
          lat,
          lng,
          geofenceRadius || 25
        );

        if (fetchedAircraft.length > 0) {
          // Update aircraft data
          updateGeofenceAircraft(fetchedAircraft);

          // Activate geofence if not already active
          if (!isGeofenceActive) {
            toggleGeofenceState(true);
          }
        } else {
          console.log('No aircraft found near clicked location');
        }

        // Center the map on this location
        if (mapInstance && typeof mapInstance.setView === 'function') {
          // Get current zoom level
          const currentZoom = mapInstance.getZoom();
          // Use appropriate zoom level based on current view
          const targetZoom = currentZoom <= 7 ? 9 : currentZoom;

          // Set view to the coordinates
          mapInstance.setView([lat, lng], targetZoom);
          mapInstance.invalidateSize();
        }
      } catch (error) {
        console.error('Error searching from panel:', error);
      } finally {
        setIsSearching(false);
        // IMPORTANT: Explicitly force the panel to stay open
        setShowPanel(true);
      }
    },
    [
      isSearching,
      geofenceRadius,
      setGeofenceLocation,
      setGeofenceCoordinates,
      setGeofenceCenter,
      updateGeofenceAircraft,
      isGeofenceActive,
      toggleGeofenceState,
      mapInstance,
    ]
  );

  // Listen for map clicks when panel is open
  useEffect(() => {
    if (!showPanel) return;

    const handleMapClick = (e: CustomEvent<{ lat: number; lng: number }>) => {
      const { lat, lng } = e.detail;
      setTempCoordinates({ lat, lng });
    };

    // Add event listener for map clicks
    document.addEventListener(
      'map-geofence-click',
      handleMapClick as EventListener
    );

    // Cleanup listener when component unmounts or panel closes
    return () => {
      document.removeEventListener(
        'map-geofence-click',
        handleMapClick as EventListener
      );
    };
  }, [showPanel]);

  // Listen for the clear all filters event
  useEffect(() => {
    const handleClearAllFilters = () => {
      // Close the floating panel when filters are cleared
      if (showPanel) {
        closePanel();
      }
    };

    // Add event listener for the clear all filters event
    document.addEventListener('ribbon-filters-cleared', handleClearAllFilters);

    // Clean up
    return () => {
      document.removeEventListener(
        'ribbon-filters-cleared',
        handleClearAllFilters
      );
    };
  }, [showPanel, closePanel]);

  return {
    showPanel,
    tempCoordinates,
    isSearching,
    locationName,
    setLocationName,
    isLoadingLocation,
    setTempCoordinates,
    setPanelPosition,
    openPanel,
    panelPosition,
    closePanel,
    resetPanel,
    setShowPanel,
    handlePanelSearch,
  };
}
