import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { EnhancedAircraftMarker } from './components/AircraftMarker';
import AircraftTrail from '../Map/components/AircraftIcon/AircraftTrail';
import { AircraftPositionService } from '../../../../lib/services/aircraftPositionService';
import type { Aircraft } from '@/types/base';
import { MAP_CONFIG, TILE_LAYER } from '../../../../constants/map';
import 'leaflet/dist/leaflet.css';

interface DynamicMapProps {
  aircraft: Array<Aircraft & {
    type: string;
    isGovernment: boolean;
  }>;
}

const DynamicMap: React.FC<DynamicMapProps> = ({ aircraft }) => {
  const [showTrails, setShowTrails] = useState(true);    // ✅ Toggle for trails
  const [isLive, setIsLive] = useState(true);            // ✅ Toggle for live tracking
  const positionService = AircraftPositionService.getInstance();

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
        <TileLayer url={TILE_LAYER.URL} attribution={TILE_LAYER.ATTRIBUTION} />

        {aircraft.map((ac) => (
          <React.Fragment key={ac.icao24}>
            {showTrails && <AircraftTrail icao24={ac.icao24} />} {/* ✅ Conditional Trail Rendering */}
            <EnhancedAircraftMarker aircraft={ac} />
          </React.Fragment>
        ))}
      </MapContainer>
    </div>
  );
};

export default DynamicMap;
