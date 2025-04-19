import React, { useState, useEffect, useRef } from 'react';
import { useEnhancedMapContext } from '../../context/EnhancedMapContext';
import { RegionCode } from '@/types/base';
import {
  MAP_CONFIG,
  getBoundsByRegion,
  getZoomLevelForRegion,
} from '@/config/map';

// Define props interface
interface RefreshButtonProps {
  onRefresh?: () => Promise<void>;
  isRefreshing?: boolean;
}

export const RibbonRefreshButton: React.FC<RefreshButtonProps> = ({
  onRefresh,
  isRefreshing: externalRefreshing,
}) => {
  // Get required context data
  const {
    refreshPositions,
    isLoading,
    mapInstance,
    selectedRegion = RegionCode.GLOBAL,
  } = useEnhancedMapContext();

  // Local state
  const [refreshing, setRefreshing] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Combine external and internal refreshing states
  const isRefreshing = externalRefreshing || refreshing;

  // Update timestamp and show tooltip
  const updateTimestampAndShowTooltip = () => {
    const now = new Date();
    setLastRefreshTime(now);
    setShowTooltip(true);

    // Hide tooltip after a delay
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    tooltipTimeoutRef.current = setTimeout(() => {
      setShowTooltip(false);
    }, 3000);
  };

  // Reset map view to appropriate zoom
  const resetMapView = () => {
    if (!mapInstance) {
      console.log('No map instance available');
      return;
    }

    // Get appropriate bounds and zoom level
    const currentRegion = selectedRegion || RegionCode.GLOBAL;
    console.log('Current region:', currentRegion);

    const bounds = getBoundsByRegion(currentRegion);
    console.log('Bounds:', bounds);

    const zoomLevel = getZoomLevelForRegion(currentRegion);
    console.log('Target zoom level:', zoomLevel);

    // Log the current zoom before changing
    console.log('Current zoom before reset:', mapInstance.getZoom());

    // Apply bounds with controlled zoom
    mapInstance.fitBounds(bounds, {
      maxZoom: zoomLevel,
      padding: MAP_CONFIG.PADDING.DEFAULT,
    });

    // Check zoom immediately after fitBounds
    console.log('Zoom after fitBounds:', mapInstance.getZoom());

    // Force exact zoom level with slight delay
    setTimeout(() => {
      console.log('Setting final zoom to:', zoomLevel);
      mapInstance.setZoom(zoomLevel);
      mapInstance.invalidateSize();

      // Verify final zoom
      console.log('Final zoom level:', mapInstance.getZoom());
    }, 150);
  };

  const handleManualRefresh = async () => {
    if (refreshing || isLoading) return;

    // If external onRefresh is provided, use it
    if (typeof onRefresh === 'function') {
      await onRefresh();
      // Update timestamp and show tooltip
      updateTimestampAndShowTooltip();
      // Reset map view
      resetMapView();
      return;
    }

    // Otherwise use internal implementation
    setRefreshing(true);
    try {
      // Perform the refresh
      if (typeof refreshPositions === 'function') {
        await refreshPositions();
      }
      updateTimestampAndShowTooltip();
      // Reset map view
      resetMapView();
    } catch (error) {
      console.error('Error refreshing aircraft data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <button
        onClick={handleManualRefresh}
        disabled={isRefreshing || isLoading}
        className={`p-2 rounded-md ${
          isRefreshing || isLoading
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
        } transition-colors`}
        title="Refresh Aircraft Data"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </button>

      {showTooltip && lastRefreshTime && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap">
          Refreshed at {lastRefreshTime.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

// Similar implementation for RibbonClearFiltersButton...
export const RibbonClearFiltersButton = () => {
  // Implementation...
};
