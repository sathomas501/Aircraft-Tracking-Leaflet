import React, { useEffect, useState } from 'react';
import { Polyline } from 'react-leaflet';
import { AircraftPositionService, Position } from './aircraftPositionService';

interface AircraftTrailProps {
  icao24: string;
}

export const AircraftTrail: React.FC<AircraftTrailProps> = ({ icao24 }) => {
  const [trailPositions, setTrailPositions] = useState<[number, number][]>([]);
  const positionService = AircraftPositionService.getInstance();

  useEffect(() => {
    const updateTrail = () => {
      const currentPos = positionService.getPosition(icao24);
      if (currentPos) {
        setTrailPositions(prev => {
          // Add new position to trail
          const newPositions = [...prev, [currentPos.latitude, currentPos.longitude]];
          // Keep only last 10 positions
          return newPositions.slice(-10);
        });
      }
    };

    // Update trail immediately
    updateTrail();

    // Set up interval to update trail
    const intervalId = setInterval(updateTrail, 5000); // Update every 5 seconds

    return () => clearInterval(intervalId);
  }, [icao24]);

  if (trailPositions.length < 2) return null;

  return (
    <Polyline
      positions={trailPositions}
      color="#3b82f6"
      weight={2}
      opacity={0.6}
      dashArray="5,5"
    />
  );
};