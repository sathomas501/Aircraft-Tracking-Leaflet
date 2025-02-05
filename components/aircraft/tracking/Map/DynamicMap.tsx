import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { EnhancedAircraftMarker } from './components/AircraftMarker';
import AircraftTrail from '../Map/components/AircraftIcon/AircraftTrail';
import { AircraftPositionService } from '../../../../lib/services/aircraftPositionService';
import type { Aircraft } from '@/types/base';
import { MAP_CONFIG, TILE_LAYER } from '../../../../config/map';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import governmentRotorIconImg from '../../../../public/icons/governmentRotorIconImg.png';
import governmentJetIconImg from '../../../../public/icons/governmentJetIconImg.png';
import propIconImg from '../../../../public/icons/propIconImg.png';
import rotorIconImg from '../../../../public/icons/rotorIconImg.png';
import jetIconImg from '../../../../public/icons/jetIconImg.png';
import defaultIconImg from '../../../../public/icons/defaultIconImg.png';

interface DynamicMapProps {
  aircraft: Aircraft[]
}

const DynamicMap: React.FC<DynamicMapProps> = ({ aircraft }) => {
  const [showTrails, setShowTrails] = useState(true);    // ✅ Toggle for trails
  const [isLive, setIsLive] = useState(true);            // ✅ Toggle for live tracking
  const positionService = AircraftPositionService.getInstance();

interface AircraftIconProps {
  aircraftType: string;
  ownerType: string;
}

const governmentRotorIcon = L.icon({
  iconUrl: governmentRotorIconImg.src,
  iconSize: [32, 32],
});

const governmentJetIcon = L.icon({
  iconUrl: governmentJetIconImg.src,
  iconSize: [32, 32],
});

const propIcon = L.icon({
  iconUrl: propIconImg.src,
  iconSize: [32, 32],
});

const rotorIcon = L.icon({
  iconUrl: rotorIconImg.src,
  iconSize: [32, 32],
});

const jetIcon = L.icon({
  iconUrl: jetIconImg.src,
  iconSize: [32, 32],
});

const defaultIcon = L.icon({
  iconUrl: defaultIconImg.src,
  iconSize: [32, 32],
});


const getMarkerIcon = (aircraft: { aircraftType: string; ownerType: string }): L.Icon => {
  const { aircraftType, ownerType } = aircraft;

  if (ownerType === 'government') {
    if (aircraftType === 'rotor') return governmentRotorIcon;
    if (aircraftType === 'jet') return governmentJetIcon;
  } else {
    if (aircraftType === 'prop') return propIcon;
    if (aircraftType === 'rotor') return rotorIcon;
    if (aircraftType === 'jet') return jetIcon;
  }

  return defaultIcon;
};

const AircraftMarkers: React.FC<{ aircraft: Aircraft[] }> = ({ aircraft }) => {
  const map = useMap();

  useEffect(() => {
    const markers: L.Marker[] = [];

    Array.isArray(aircraft) && aircraft.forEach((plane) => {
      const icon = getMarkerIcon({
        aircraftType: plane.TYPE_AIRCRAFT,
        ownerType: plane.OWNER_TYPE,
      });

      const marker = L.marker([plane.latitude, plane.longitude], { icon })
        .addTo(map)
        .bindPopup(`
          <strong>${plane['N-NUMBER'] || 'Unknown Aircraft'}</strong><br/>
          Type: ${plane.TYPE_AIRCRAFT || 'N/A'}<br/>
          Owner: ${plane.OWNER_TYPE || 'N/A'}
        `);
      
      markers.push(marker);
    });

    return () => {
      markers.forEach(marker => marker.remove());
    };
  }, [aircraft, map]);

  return null;
};

  // ✅ Dynamic Updates (Batch Fetch Positions)
  useEffect(() => {
    if (!isLive) return; // Skip updates if live tracking is disabled

    const updateAllAircraft = async () => {
      await positionService.batchUpdate(aircraft.map((ac) => ac.icao24));
    };

    updateAllAircraft();
    const intervalId = setInterval(updateAllAircraft, 5000); // Update every 5 seconds

    return () => clearInterval(intervalId); // Cleanup
  }, [isLive, aircraft]);

  return (
    <div className="h-screen w-full relative">
      <MapContainer
        center={MAP_CONFIG.CENTER}
        zoom={MAP_CONFIG.DEFAULT_ZOOM}
        className="h-full w-full"
        minZoom={MAP_CONFIG.OPTIONS.minZoom}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <AircraftMarkers aircraft={aircraft} />
        {aircraft?.map((ac, index) => (
          <React.Fragment key={`aircraft-${ac.icao24}-${index}`}>
            {showTrails && <AircraftTrail key={`trail-${ac.icao24}`} icao24={ac.icao24} />}
            <EnhancedAircraftMarker
              key={`marker-${ac.icao24}`}
              aircraft={{
                ...ac,
                type: ac.TYPE_AIRCRAFT,
                isGovernment: ac.OWNER_TYPE === 'government'
              }}
            />
          </React.Fragment>
        ))}
      </MapContainer>
    </div>
  );
};

export default DynamicMap;
