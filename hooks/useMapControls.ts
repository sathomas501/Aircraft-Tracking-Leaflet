// hooks/useMapControl.ts
import { useRef, useEffect } from 'react';
import {
  MAP_CONFIG,
  getBoundsByRegion,
  getZoomLevelForRegion,
} from '../config/map';
import { RegionCode } from '../types/base';

interface ResetMapViewOptions {
  region?: RegionCode;
  maxZoom?: number;
  animate?: boolean;
}

interface UseMapControlReturn {
  resetMapView: (options?: ResetMapViewOptions) => void;
  drawRegionOutline: (region: RegionCode) => void;
  clearRegionOutline: () => void;
}

export function useMapControl(mapInstance: any): UseMapControlReturn {
  const regionOutlineRef = useRef<any>(null);

  // Function to reset map view with controlled zoom
  const resetMapView = (options: ResetMapViewOptions = {}) => {
    if (!mapInstance) return;

    const { region = RegionCode.GLOBAL, maxZoom = 2, animate = true } = options;

    try {
      // Get bounds for the region
      const bounds = getBoundsByRegion(region);
      const zoomLevel = getZoomLevelForRegion(region);

      // Apply bounds
      mapInstance.fitBounds(bounds, {
        maxZoom,
        padding: [20, 20],
        animate,
      });

      // Force the specific zoom level we want
      setTimeout(() => {
        mapInstance.setZoom(zoomLevel);
        mapInstance.invalidateSize();
      }, 100);
    } catch (error) {
      console.error('Error resetting map view:', error);
    }
  };

  // Function to draw region outline
  const drawRegionOutline = (region: RegionCode) => {
    if (!mapInstance) return null;

    // Clear existing outline
    clearRegionOutline();

    // Get bounds for region
    const bounds = getBoundsByRegion(region);
    if (!bounds) return null;

    // Create outline
    const L = require('leaflet');
    const rectangle = L.rectangle(bounds, {
      color: '#4f46e5',
      weight: 3,
      opacity: 0.7,
      fill: true,
      fillColor: '#4f46e5',
      fillOpacity: 0.1,
      dashArray: '5, 10',
      interactive: false,
    });

    // Add to map
    rectangle.addTo(mapInstance);
    regionOutlineRef.current = rectangle;

    return rectangle;
  };

  // Function to clear region outline
  const clearRegionOutline = () => {
    if (regionOutlineRef.current) {
      try {
        regionOutlineRef.current.remove();
      } catch (error) {
        console.error('Error removing region outline:', error);
      }
      regionOutlineRef.current = null;
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearRegionOutline();
    };
  }, []);

  return {
    resetMapView,
    drawRegionOutline,
    clearRegionOutline,
  };
}
