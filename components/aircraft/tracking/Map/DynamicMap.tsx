// DynamicMap.tsx
import React, { useEffect, useRef, useState } from 'react';
import type { ExtendedAircraft } from '@/types/base';
import { MAP_CONFIG } from '@/config/map';
import {
  getIconSizeForZoom,
  createTooltipContent,
  createPopupContent,
} from '../Map/components/AircraftIcon/AircraftIcon';

export interface DynamicMapProps {
  aircraft: ExtendedAircraft[];
  onError: (message: string) => void;
}

const DynamicMap: React.FC<DynamicMapProps> = ({ aircraft, onError }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null); // Store map instance in a ref
  const markerLayerRef = useRef<any>(null); // Store marker layer in a ref
  const markersRef = useRef<Map<string, any>>(new Map()); // Track markers by icao24
  const leafletRef = useRef<any>(null); // Store Leaflet instance in a ref
  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const [currentZoom, setCurrentZoom] = useState<number>(
    MAP_CONFIG.DEFAULT_ZOOM
  );

  // Initialize Leaflet and map
  useEffect(() => {
    // Don't re-initialize if already done
    if (isMapInitialized || !mapContainerRef.current) return;

    let isMounted = true;

    const initMap = async () => {
      try {
        console.log('[DynamicMap] Initializing map...');

        // Clean up any existing map instance first
        if (mapInstanceRef.current) {
          console.log('[DynamicMap] Cleaning up existing map instance');
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
          markerLayerRef.current = null;
          markersRef.current.clear();
        }

        // Import Leaflet dynamically
        const leaflet = (await import('leaflet')).default;
        await import('leaflet/dist/leaflet.css');

        // If component unmounted during async operation, abort
        if (!isMounted || !mapContainerRef.current) return;

        leafletRef.current = leaflet;

        // Create new map instance
        console.log('[DynamicMap] Creating new map instance');
        const mapInstance = leaflet.map(mapContainerRef.current, {
          center: MAP_CONFIG.CENTER,
          zoom: MAP_CONFIG.DEFAULT_ZOOM,
          minZoom: MAP_CONFIG.OPTIONS.minZoom,
          maxZoom: MAP_CONFIG.OPTIONS.maxZoom,
          preferCanvas: true,
          worldCopyJump: true,
        });

        mapInstanceRef.current = mapInstance;
        setCurrentZoom(mapInstance.getZoom());

        // Set up base layers
        const layers = {
          Topographic: leaflet.tileLayer(
            'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
            {
              attribution: '© OpenTopoMap contributors',
              maxZoom: 17,
            }
          ),
          Streets: leaflet.tileLayer(
            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            {
              attribution: '© OpenStreetMap contributors',
            }
          ),
          Satellite: leaflet.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            {
              attribution: '© Esri',
              maxZoom: 19,
            }
          ),
        };

        // Add default layer
        layers.Topographic.addTo(mapInstance);

        // Add layer control
        leaflet.control.layers(layers).addTo(mapInstance);

        // Add marker layer
        markerLayerRef.current = leaflet.layerGroup().addTo(mapInstance);

        // Set up zoom change event handler
        mapInstance.on('zoomend', () => {
          const newZoom = mapInstance.getZoom();
          setCurrentZoom(newZoom);
          updateMarkersForZoom(newZoom);
        });

        // Set up resize listener for the map
        mapInstance.on('resize', () => {
          updateMarkersForZoom(mapInstance.getZoom());
        });

        setIsMapInitialized(true);
        console.log('[DynamicMap] Map initialized successfully');
      } catch (error) {
        console.error('[DynamicMap] Failed to initialize map:', error);
        onError('Failed to initialize map');
      }
    };

    initMap();

    // Cleanup function
    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        console.log('[DynamicMap] Removing map on unmount');
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerLayerRef.current = null;
        markersRef.current.clear();
        setIsMapInitialized(false);
      }
    };
  }, [onError]); // Only run on mount and when onError changes

  // Function to update markers based on zoom level
  const updateMarkersForZoom = (zoomLevel: number) => {
    if (!leafletRef.current || !markerLayerRef.current) return;

    const L = leafletRef.current;

    // Update existing markers
    markersRef.current.forEach((marker, icao24) => {
      // Find aircraft data for this marker
      const plane = aircraft.find((a) => a.icao24 === icao24);
      if (!plane) return;

      // Get the appropriate icon size for this zoom level
      const size = getIconSizeForZoom(zoomLevel, false);

      // Update icon
      marker.setIcon(
        L.icon({
          iconUrl: plane.isGovernment
            ? '/icons/governmentJetIconImg.png'
            : '/icons/jetIconImg.png',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          popupAnchor: [0, -size / 2],
        })
      );

      // Update popup with new content
      const popup = marker.getPopup();
      if (popup) {
        popup.setContent(createPopupContent(plane, zoomLevel));
      }

      // Update tooltip with new content
      const tooltip = marker.getTooltip();
      if (tooltip) {
        tooltip.setContent(createTooltipContent(plane, zoomLevel));
      }
    });
  };

  // Update aircraft markers when aircraft data changes
  useEffect(() => {
    if (
      !isMapInitialized ||
      !mapInstanceRef.current ||
      !markerLayerRef.current ||
      !leafletRef.current
    )
      return;

    try {
      const L = leafletRef.current;
      const currentZoomLevel = currentZoom;
      console.log('[DynamicMap] Updating aircraft positions:', aircraft.length);

      // Track which aircraft are still present
      const currentIcao24s = new Set(aircraft.map((a) => a.icao24));

      // Remove markers that are no longer present
      markersRef.current.forEach((marker, icao24) => {
        if (!currentIcao24s.has(icao24)) {
          markerLayerRef.current.removeLayer(marker);
          markersRef.current.delete(icao24);
        }
      });

      // Filter out aircraft with invalid coordinates
      const validAircraft = aircraft.filter(
        (plane) =>
          typeof plane.latitude === 'number' &&
          typeof plane.longitude === 'number' &&
          !isNaN(plane.latitude) &&
          !isNaN(plane.longitude)
      );

      // Add or update markers
      validAircraft.forEach((plane) => {
        // Determine icon size based on current zoom level
        const size = getIconSizeForZoom(currentZoomLevel, false);

        if (markersRef.current.has(plane.icao24)) {
          // Update existing marker
          const marker = markersRef.current.get(plane.icao24);
          marker.setLatLng([plane.latitude, plane.longitude]);

          // Update popup content
          const popup = marker.getPopup();
          if (popup) {
            popup.setContent(createPopupContent(plane, currentZoomLevel));
          }

          // Update tooltip
          const tooltip = marker.getTooltip();
          if (tooltip) {
            tooltip.setContent(createTooltipContent(plane, currentZoomLevel));
          }
        } else {
          // Create new marker
          const marker = L.marker([plane.latitude, plane.longitude], {
            icon: L.icon({
              iconUrl: plane.isGovernment
                ? '/icons/governmentJetIconImg.png'
                : '/icons/jetIconImg.png',
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2],
              popupAnchor: [0, -size / 2],
            }),
          });

          // Create popup content
          const popupContent = createPopupContent(plane, currentZoomLevel);
          marker.bindPopup(popupContent);

          // Create tooltip
          const tooltipContent = createTooltipContent(plane, currentZoomLevel);
          marker.bindTooltip(tooltipContent, {
            direction: 'top',
            offset: [0, -size / 2],
            opacity: 0.9,
            className: 'aircraft-tooltip',
          });

          // Store the marker and add to layer
          markersRef.current.set(plane.icao24, marker);
          markerLayerRef.current.addLayer(marker);
        }
      });

      // Auto-fit bounds if we have aircraft
      if (validAircraft.length > 0) {
        const bounds = L.latLngBounds(
          validAircraft.map((a) => [a.latitude, a.longitude])
        );
        mapInstanceRef.current.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 10, // Prevent too much zoom
        });
      }
    } catch (error) {
      console.error('[DynamicMap] Error updating aircraft:', error);
      onError('Failed to update aircraft positions');
    }
  }, [aircraft, isMapInitialized, onError, currentZoom]);

  // Force map re-initialization on window resize
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
        // Update markers after resize
        updateMarkersForZoom(mapInstanceRef.current.getZoom());
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full"
      style={{ backgroundColor: '#f0f0f0' }} // Placeholder color while loading
      id="map-container" // Giving it a static ID helps with debugging
    />
  );
};

export default DynamicMap;
