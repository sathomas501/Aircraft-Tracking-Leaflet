import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MAP_CONFIG } from '@/config/map';
import type { Aircraft } from '@/types/base';

export interface ExtendedAircraft extends Aircraft {
  type: string;
  isGovernment: boolean;
}

export interface DynamicMapProps {
  aircraft: ExtendedAircraft[];
}

const DynamicMap: React.FC<DynamicMapProps> = ({ aircraft }) => {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [mapInitialized, setMapInitialized] = useState(false);

  // Create a marker layer group to manage markers
  const markerLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize map and marker layer group
  useEffect(() => {
    if (!mapContainerRef.current || mapInitialized) return;

    try {
      const map = L.map(mapContainerRef.current, {
        center: MAP_CONFIG.CENTER,
        zoom: MAP_CONFIG.DEFAULT_ZOOM,
        minZoom: MAP_CONFIG.OPTIONS.minZoom,
        maxZoom: MAP_CONFIG.OPTIONS.maxZoom,
        scrollWheelZoom: true,
        worldCopyJump: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      // Create marker layer group
      const markerLayer = L.layerGroup().addTo(map);

      // Store references
      mapRef.current = map;
      markerLayerRef.current = markerLayer;

      setMapInitialized(true);
      console.log('[Map] ✅ Map initialized successfully');
    } catch (error) {
      console.error('[Map] ❌ Failed to initialize map:', error);
    }

    return () => {
      if (markerLayerRef.current) {
        markerLayerRef.current.clearLayers();
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerLayerRef.current = null;
        setMapInitialized(false);
      }
    };
  }, []);

  // Update aircraft markers
  useEffect(() => {
    if (!mapInitialized || !markerLayerRef.current) return;

    console.log('[Map] 🔄 Updating aircraft positions:', aircraft.length);

    try {
      // Clear existing markers
      markerLayerRef.current.clearLayers();

      // Add new markers
      aircraft.forEach((plane) => {
        if (!plane.latitude || !plane.longitude) {
          console.warn('[Map] ⚠️ Aircraft missing coordinates:', plane.icao24);
          return;
        }

        const position = L.latLng(plane.latitude, plane.longitude);
        const marker = L.marker(position, {
          icon: new L.Icon({
            iconUrl: plane.isGovernment
              ? '/icons/governmentJetIconImg.png'
              : '/icons/jetIconImg.png',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            popupAnchor: [0, -12],
          }),
        }).bindPopup(`
          <div class="aircraft-popup">
            <h3 class="text-lg font-bold">${plane.icao24.toUpperCase()}</h3>
            <div class="text-sm">
              <p>Altitude: ${Math.round(plane.altitude)} ft</p>
              <p>Speed: ${Math.round(plane.velocity)} knots</p>
              <p>Heading: ${Math.round(plane.heading)}°</p>
              ${plane.model ? `<p>Model: ${plane.model}</p>` : ''}
              ${plane['N-NUMBER'] ? `<p>N-Number: ${plane['N-NUMBER']}</p>` : ''}
            </div>
          </div>
        `);

        markerLayerRef.current?.addLayer(marker);
        markersRef.current[plane.icao24] = marker;
      });
    } catch (error) {
      console.error('[Map] ❌ Error updating aircraft markers:', error);
    }
  }, [aircraft, mapInitialized]);

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainerRef} className="absolute inset-0" />
      <div className="absolute bottom-4 right-4 bg-white p-2 rounded shadow z-[1000]">
        Aircraft Tracked: {aircraft.length}
      </div>
    </div>
  );
};

export default DynamicMap;
