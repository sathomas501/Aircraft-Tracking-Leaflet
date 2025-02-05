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

  const map = useMap(); // ✅ Access the current map instance

  if (ownerType === 'government') {
    if (aircraftType === 'rotor') return governmentRotorIcon;
    if (aircraftType === 'jet') return governmentJetIcon;
  } else {
    if (aircraftType === 'prop') return propIcon;
    if (aircraftType === 'rotor') return rotorIcon;
    if (aircraftType === 'jet') return jetIcon;
  }

  return defaultIcon; // Fallback for undefined combinations
};

const AircraftMarkers: React.FC<{ aircraft: Aircraft[] }> = ({ aircraft }) => {
  const map = useMap(); // ✅ Access the current map instance

  useEffect(() => {
    Array.isArray(aircraft) && aircraft.forEach((plane) => {
      const icon = getMarkerIcon({
        aircraftType: plane.TYPE_AIRCRAFT,
        ownerType: plane.OWNER_TYPE,
      });

      L.marker([plane.latitude, plane.longitude], { icon })
        .addTo(map) // ✅ Add marker to the map instance
        .bindPopup(`
          <strong>${plane['N-NUMBER'] || 'Unknown Aircraft'}</strong><br/>
          Type: ${plane.TYPE_AIRCRAFT || 'N/A'}<br/>
          Owner: ${plane.OWNER_TYPE || 'N/A'}
        `);
    });
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
    <div style={{ height: '100vh', width: '100%' }}>
      {/* ✅ Control Panel */}
      <div style={{ position: 'absolute', zIndex: 1000, top: 10, right: 10 }}>
        <button
          style={{
            padding: '8px 12px',
            margin: '5px',
            backgroundColor: showTrails ? '#3b82f6' : '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
          onClick={() => setShowTrails((prev) => !prev)}
        >
          {showTrails ? 'Hide Trails' : 'Show Trails'}
        </button>

        <button
          style={{
            padding: '8px 12px',
            margin: '5px',
            backgroundColor: isLive ? '#10b981' : '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
          onClick={() => setIsLive((prev) => !prev)}
        >
          {isLive ? 'Pause Live Updates' : 'Resume Live Updates'}
        </button>
      </div>

      <MapContainer
        center={MAP_CONFIG.CENTER}
        zoom={MAP_CONFIG.DEFAULT_ZOOM}
        style={{ height: '100%', width: '100%' }}
        minZoom={MAP_CONFIG.OPTIONS.minZoom}
        scrollWheelZoom={true}
        maxBoundsViscosity={0}
        worldCopyJump={false}
        dragging={true}
        inertia={true}
        inertiaDeceleration={1000}
        inertiaMaxSpeed={1000}
        zoomControl={true}
      >
        <AircraftMarkers aircraft={aircraft} />

        {aircraft.map((ac) => (
          <React.Fragment key={ac.icao24}>
            {showTrails && <AircraftTrail icao24={ac.icao24} />} {/* ✅ Conditional Trail Rendering */}
            <EnhancedAircraftMarker aircraft={{ ...ac, type: ac.TYPE_AIRCRAFT, isGovernment: ac.OWNER_TYPE === 'government' }} />
          </React.Fragment>
        ))}
      </MapContainer>
    </div>
  );
};

export default DynamicMap;
