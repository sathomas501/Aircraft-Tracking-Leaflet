import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Aircraft } from '@/types/base';  // Ensure this path is correct
import { createAircraftIcon } from './components/AircraftIcon/AircraftIcon';

// ✅ Define or import MapComponentProps if missing
export interface MapComponentProps {
  aircraft: Aircraft[];
}

const MapComponent: React.FC<MapComponentProps> = ({ aircraft }) => {
  const usCenter: [number, number] = [39.8283, -98.5795];

  // ✅ Filter out aircraft with missing coordinates
  console.log("[Map Debug] Aircraft Data Before Rendering:", aircraft);

 

  const validAircraft = aircraft.filter(
    (plane) => plane.latitude != null && plane.longitude != null
  );

  console.log("[Map Debug] Valid Aircraft:", validAircraft);
  
  console.log("[Map Debug] Valid Aircraft for Leaflet:", validAircraft);
  
  if (validAircraft.length === 0) {
    console.error("[Map Debug] No valid aircraft to display.");
    return <div>No active aircraft found.</div>;
  }
  
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
      
      {validAircraft.map((plane: Aircraft) => (
        <Marker
          key={plane.icao24}
          position={[plane.latitude, plane.longitude]}
          icon={createAircraftIcon(plane)}
        >
          <Popup>
            <div className="p-2">
              <h3 className="font-bold">{plane.registration || plane.icao24}</h3>
              <p>Altitude: {plane.altitude ? Math.round(plane.altitude * 3.28084) + " ft" : "N/A"}</p>
              <p>Speed: {plane.velocity ? Math.round(plane.velocity * 1.944) + " knots" : "N/A"}</p>
              <p>Heading: {plane.heading ? Math.round(plane.heading) + "°" : "N/A"}</p>
              {plane.on_ground && <p className="text-yellow-600">On Ground</p>}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default MapComponent;
