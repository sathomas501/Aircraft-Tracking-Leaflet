import React, { useEffect, useState } from 'react';
import { Polyline } from 'react-leaflet';
import { AircraftPositionService } from '../../../../../../lib/services/aircraftPositionService';
import { LatLngTuple, PathOptions } from 'leaflet';

interface AircraftTrailProps {
  icao24: string;
}

const AircraftTrail: React.FC<AircraftTrailProps> = ({ icao24 }) => {
  const [positions, setPositions] = useState<LatLngTuple[]>([]);
  const positionService = AircraftPositionService.getInstance();

  useEffect(() => {
    const updateTrail = () => {
      const currentPos = positionService.getPosition(icao24);
      if (currentPos) {
        const newPosition: LatLngTuple = [currentPos.latitude, currentPos.longitude];
        setPositions(prev => {
          const newTrail = [...prev, newPosition];
          return newTrail.slice(-10) as LatLngTuple[]; // Keep last 10 positions
        });
      }
    };

    // Update trail immediately
    updateTrail();

    // Set up interval to update trail
    const intervalId = setInterval(updateTrail, 5000);

    return () => clearInterval(intervalId);
  }, [icao24]);

  if (positions.length < 2) return null;

  const pathOptions: PathOptions = {
    color: '#3b82f6',
    weight: 2,
    opacity: 0.6,
    dashArray: '5,5'
  };

  return (
    <Polyline 
      positions={positions}
      pathOptions={pathOptions}
    />
  );
};

export default AircraftTrail;