// DynamicMap.tsx
import React, { useEffect, useRef, useState } from 'react';
import type { ExtendedAircraft } from '@/types/base';
import { MAP_CONFIG } from '@/config/map';

export interface DynamicMapProps {
  aircraft: ExtendedAircraft[];
  onError: (message: string) => void;
}

const DynamicMap: React.FC<DynamicMapProps> = ({ aircraft, onError }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null); // Store map instance in a ref instead of state
  const markerLayerRef = useRef<any>(null); // Store marker layer in a ref
  const leafletRef = useRef<any>(null); // Store Leaflet instance in a ref
  const [isMapInitialized, setIsMapInitialized] = useState(false);

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
        }

        // Import Leaflet dynamically
        const leaflet = (await import('leaflet')).default;
        await import('leaflet/dist/leaflet.css');

        // If component unmounted during async operation, abort
        if (!isMounted || !mapContainerRef.current) return;

        leafletRef.current = leaflet;

        // Create new map instance
        console.log('[DynamicMap] Creating new map instance');
        mapInstanceRef.current = leaflet.map(mapContainerRef.current, {
          center: MAP_CONFIG.CENTER,
          zoom: MAP_CONFIG.DEFAULT_ZOOM,
          minZoom: MAP_CONFIG.OPTIONS.minZoom,
          maxZoom: MAP_CONFIG.OPTIONS.maxZoom,
          preferCanvas: true,
          worldCopyJump: true,
        });

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
        layers.Topographic.addTo(mapInstanceRef.current);

        // Add layer control
        leaflet.control.layers(layers).addTo(mapInstanceRef.current);

        // Add marker layer
        markerLayerRef.current = leaflet
          .layerGroup()
          .addTo(mapInstanceRef.current);

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
        setIsMapInitialized(false);
      }
    };
  }, [onError]); // Only run on mount and when onError changes

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
      console.log('[DynamicMap] Updating aircraft positions:', aircraft.length);

      // Clear existing markers
      markerLayerRef.current.clearLayers();

      // Filter out aircraft with invalid coordinates
      const validAircraft = aircraft.filter(
        (plane) =>
          typeof plane.latitude === 'number' &&
          typeof plane.longitude === 'number' &&
          !isNaN(plane.latitude) &&
          !isNaN(plane.longitude)
      );

      // Add new markers
      validAircraft.forEach((plane) => {
        const marker = L.marker([plane.latitude, plane.longitude], {
          icon: L.icon({
            iconUrl: plane.isGovernment
              ? '/icons/governmentJetIconImg.png'
              : '/icons/jetIconImg.png',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            popupAnchor: [0, -12],
          }),
        });

        // Create popup content
        const content = `
          <div class="aircraft-popup p-2">
            <h3 class="text-lg font-bold mb-2">${plane.icao24.toUpperCase()}</h3>
            <div class="text-sm space-y-1">
              <p><span class="font-semibold">Model:</span> ${plane.model || 'Unknown'}</p>
              <p><span class="font-semibold">Type:</span> ${plane.type || 'Unknown'}</p>
              <p><span class="font-semibold">Altitude:</span> ${Math.round(plane.altitude || 0)} ft</p>
              <p><span class="font-semibold">Speed:</span> ${Math.round(plane.velocity || 0)} knots</p>
              <p><span class="font-semibold">Heading:</span> ${Math.round(plane.heading || 0)}°</p>
              ${plane['N-NUMBER'] ? `<p><span class="font-semibold">N-Number:</span> ${plane['N-NUMBER']}</p>` : ''}
            </div>
          </div>
        `;

        marker.bindPopup(content);
        markerLayerRef.current.addLayer(marker);
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
  }, [aircraft, isMapInitialized, onError]);

  // Force map re-initialization on window resize
  useEffect(() => {
    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
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
