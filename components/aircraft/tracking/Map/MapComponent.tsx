import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Aircraft } from '@/types/base';

// Define MapComponentProps
export interface MapComponentProps {
  aircraft: Aircraft[];
}

// Dynamically import the map to avoid SSR issues
const MapWithNoSSR = dynamic(() =>
  Promise.all([
    import('react-leaflet'),
    import('leaflet'),
  ]).then(([{ MapContainer, TileLayer, Marker, Popup }]) => {
    return function Map({ aircraft }: MapComponentProps) {
      const [mounted, setMounted] = useState(false);
      const usCenter: [number, number] = [39.8283, -98.5795]; // Centered on the US

      // Debugging aircraft data when received
      useEffect(() => {
        console.log("[Map Debug] Aircraft Data Received:", {
          total: aircraft.length,
          sample: aircraft.slice(0, 5),
        });
      }, [aircraft]);

      useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
      }, []);

      // ✅ Filter only valid aircraft (ensure lat/long exist)
      const validAircraft = aircraft.filter(ac => ac.latitude !== undefined && ac.longitude !== undefined);

      if (!mounted) return null;

      return (
        <MapContainer
          center={usCenter}
          zoom={4}
          style={{ height: '100%', width: '100%' }}
          minZoom={3}
          maxBounds={[
            [24.396308, -125.000000], // Southwest coordinates
            [49.384358, -66.934570],  // Northeast coordinates
          ]}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {/* ✅ Ensure aircraft markers are added dynamically */}
          {validAircraft.map((ac) => (
            <Marker key={ac.icao24} position={[ac.latitude, ac.longitude]}>
              <Popup>
                <strong>ICAO24:</strong> {ac.icao24} <br />
                <strong>Altitude:</strong> {ac.altitude ? `${ac.altitude} ft` : "Unknown"} <br />
                <strong>Velocity:</strong> {ac.velocity ? `${ac.velocity} kt` : "Unknown"} <br />
                <strong>Heading:</strong> {ac.heading ? `${ac.heading}°` : "Unknown"} <br />
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      );
    };
  }),
  {
    ssr: false, // Disable server-side rendering for the map
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-gray-100">
        <p className="text-gray-600">Loading map...</p>
      </div>
    ),
  }
);

// ✅ Main MapComponent wrapper
const MapComponent: React.FC<MapComponentProps> = ({ aircraft }) => {
  return <MapWithNoSSR aircraft={aircraft} />;
};

export default MapComponent;
