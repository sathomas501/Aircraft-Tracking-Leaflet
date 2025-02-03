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
    let isMounted = true;

    const updateTrail = async () => {
      try {
        const currentPos = positionService.getPosition(icao24);
        if (isMounted && currentPos) {
          const newPosition: LatLngTuple = [currentPos.latitude, currentPos.longitude];

          setPositions((prev) => {
            if (
              prev.length === 0 ||
              prev[prev.length - 1][0] !== newPosition[0] ||
              prev[prev.length - 1][1] !== newPosition[1]
            ) {
              return [...prev, newPosition].slice(-10); // Keep last 10 positions
            }
            return prev;
          });
        }
      } catch (error) {
        console.error('Error fetching aircraft position:', error);
      }
    };

    updateTrail();
    const intervalId = setInterval(updateTrail, 5000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [icao24]);

  if (positions.length < 2) return null;

  const pathOptions: PathOptions = {
    color: '#3b82f6',
    weight: 3,
    opacity: 0.7,
    dashArray: '5,5',
  };

  return <Polyline positions={positions} pathOptions={pathOptions} />;
};

export default AircraftTrail;
