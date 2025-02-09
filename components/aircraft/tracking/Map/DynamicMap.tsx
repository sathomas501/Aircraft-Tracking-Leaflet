import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MAP_CONFIG } from '@/config/map'; // ✅ Import the map configuration
import type { Aircraft } from '@/types/base';

// Extended Aircraft type to include UI-specific properties
export interface ExtendedAircraft extends Aircraft {
  type: string;
  isGovernment: boolean;
}

export interface DynamicMapProps {
  aircraft: ExtendedAircraft[];
}

const DynamicMap: React.FC<DynamicMapProps> = ({ aircraft }) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize the map only if it hasn't been initialized yet
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        center: MAP_CONFIG.CENTER, // ✅ Use config values
        zoom: MAP_CONFIG.DEFAULT_ZOOM, // ✅ Use config values
        minZoom: MAP_CONFIG.OPTIONS.minZoom,
        maxZoom: MAP_CONFIG.OPTIONS.maxZoom,
        scrollWheelZoom: MAP_CONFIG.OPTIONS.scrollWheelZoom,
        worldCopyJump: MAP_CONFIG.OPTIONS.worldCopyJump,
      });

      // Add Tile Layer from config
      L.tileLayer(MAP_CONFIG.CONTROLS.TILE_LAYER.URL, {
        attribution: MAP_CONFIG.CONTROLS.TILE_LAYER.ATTRIBUTION,
      }).addTo(mapRef.current);

      // Add Zoom Control at the top-right from config
      L.control
        .zoom({ position: MAP_CONFIG.CONTROLS.POSITION.TOP_RIGHT })
        .addTo(mapRef.current);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove(); // Cleanup map when component unmounts
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing markers before adding new ones
    mapRef.current.eachLayer((layer) => {
      if ((layer as L.Marker).getLatLng) {
        mapRef.current?.removeLayer(layer);
      }
    });

    // Add aircraft markers
    aircraft.forEach((plane) => {
      if (plane.latitude && plane.longitude) {
        L.marker([plane.latitude, plane.longitude])
          .addTo(mapRef.current!)
          .bindPopup(
            `<b>${plane.NAME}</b><br>${plane.model}<br>${plane.CITY}, ${plane.STATE}`
          );
      }
    });
  }, [aircraft]);

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainerRef} className="absolute inset-0" />
    </div>
  );
};

export default DynamicMap;
