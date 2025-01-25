import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Aircraft } from '@/types/base';
import { createAircraftIcon } from './components/AircraftIcon/AircraftIcon';

export interface MapComponentProps {
  aircraft: Aircraft[];
 }

const MapComponent: React.FC<MapComponentProps> = ({ aircraft }) => {
  const usCenter: [number, number] = [39.8283, -98.5795];

  return (
    <MapContainer 
      center={usCenter}
      zoom={4} 
      style={{ height: '100%', width: '100%' }}
      minZoom={3}
      maxBounds={[
        [24.396308, -125.000000], // Southwest
        [49.384358, -66.934570]   // Northeast
      ]}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      
      {aircraft.map((plane) => (
        <Marker
          key={plane.icao24}
          position={[plane.latitude, plane.longitude]}
          icon={createAircraftIcon(plane)}
        >
          <Popup>
            <div className="p-2">
              <h3 className="font-bold">{plane.registration || plane.icao24}</h3>
              <p>Altitude: {Math.round(plane.altitude * 3.28084)} ft</p>
              <p>Speed: {Math.round(plane.velocity * 1.944)} knots</p>
              <p>Heading: {Math.round(plane.heading)}°</p>
              {plane.on_ground && (
                <p className="text-yellow-600">On Ground</p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default MapComponent;