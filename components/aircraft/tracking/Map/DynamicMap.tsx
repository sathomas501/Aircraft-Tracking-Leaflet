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
  const [L, setL] = useState<any>(null);
  const [map, setMap] = useState<any>(null);
  const [markerLayer, setMarkerLayer] = useState<any>(null);

  // Initialize Leaflet and map
  useEffect(() => {
    let mounted = true;

    const initMap = async () => {
      try {
        if (!mapContainerRef.current || map) return;

        // Import Leaflet dynamically
        const L = (await import('leaflet')).default;
        await import('leaflet/dist/leaflet.css');

        if (!mounted || !mapContainerRef.current) return;
        setL(L);

        const newMap = L.map(mapContainerRef.current, {
          center: MAP_CONFIG.CENTER,
          zoom: MAP_CONFIG.DEFAULT_ZOOM,
          minZoom: MAP_CONFIG.OPTIONS.minZoom,
          maxZoom: MAP_CONFIG.OPTIONS.maxZoom,
          preferCanvas: true,
          worldCopyJump: true,
        });

        // Set up base layers
        const layers = {
          Topographic: L.tileLayer(
            'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
            {
              attribution: '© OpenTopoMap contributors',
              maxZoom: 17,
            }
          ),
          Streets: L.tileLayer(
            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            {
              attribution: '© OpenStreetMap contributors',
            }
          ),
          Satellite: L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            {
              attribution: '© Esri',
              maxZoom: 19,
            }
          ),
        };

        // Add default layer
        layers.Topographic.addTo(newMap);

        // Add layer control
        L.control.layers(layers).addTo(newMap);

        // Add marker layer
        const newMarkerLayer = L.layerGroup().addTo(newMap);

        setMap(newMap);
        setMarkerLayer(newMarkerLayer);
        console.log('[DynamicMap] Map initialized successfully');
      } catch (error) {
        console.error('[DynamicMap] Failed to initialize map:', error);
        onError('Failed to initialize map');
      }
    };

    initMap();

    return () => {
      mounted = false;
      if (map) {
        map.remove();
        setMap(null);
        setMarkerLayer(null);
      }
    };
  }, []);

  // Update aircraft markers
  useEffect(() => {
    if (!map || !markerLayer || !L) return;

    try {
      console.log('[DynamicMap] Updating aircraft positions:', aircraft.length);
      markerLayer.clearLayers();

      const validAircraft = aircraft.filter(
        (plane) =>
          typeof plane.latitude === 'number' &&
          typeof plane.longitude === 'number' &&
          !isNaN(plane.latitude) &&
          !isNaN(plane.longitude)
      );

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
              <p><span class="font-semibold">Altitude:</span> ${Math.round(plane.altitude)} ft</p>
              <p><span class="font-semibold">Speed:</span> ${Math.round(plane.velocity)} knots</p>
              <p><span class="font-semibold">Heading:</span> ${Math.round(plane.heading)}°</p>
              ${plane['N-NUMBER'] ? `<p><span class="font-semibold">N-Number:</span> ${plane['N-NUMBER']}</p>` : ''}
            </div>
          </div>
        `;

        marker.bindPopup(content);
        markerLayer.addLayer(marker);
      });

      // Auto-fit bounds if we have aircraft
      if (validAircraft.length > 0) {
        const bounds = L.latLngBounds(
          validAircraft.map((a) => [a.latitude, a.longitude])
        );
        map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 10, // Prevent too much zoom
        });
      }
    } catch (error) {
      console.error('[DynamicMap] Error updating aircraft:', error);
      onError('Failed to update aircraft positions');
    }
  }, [aircraft, map, markerLayer, L]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full"
      style={{ backgroundColor: '#f0f0f0' }} // Placeholder color while loading
    />
  );
};

export default DynamicMap;
