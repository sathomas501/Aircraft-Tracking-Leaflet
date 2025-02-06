import React, { useEffect, useState } from 'react';
import { Polyline } from 'react-leaflet';
import {
  UnifiedAircraftService,
  aircraftService,
} from '../../../../../../lib/services/Unified-Aircraft-Position-Service';
import { LatLngTuple, PathOptions } from 'leaflet';

interface AircraftTrailProps {
  icao24: string;
}

const AircraftTrail: React.FC<AircraftTrailProps> = ({ icao24 }) => {
  const [positions, setPositions] = useState<LatLngTuple[]>([]);

  useEffect(() => {
    // Get initial position history
    const history = aircraftService.getPositionHistory(icao24);
    setPositions(history.map((pos) => [pos.latitude, pos.longitude]));

    // You could add an interval here to update the trail periodically if needed
    const interval = setInterval(() => {
      const updatedHistory = aircraftService.getPositionHistory(icao24);
      setPositions(updatedHistory.map((pos) => [pos.latitude, pos.longitude]));
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [icao24]);

  const pathOptions: PathOptions = {
    color: 'blue',
    weight: 2,
    opacity: 0.6,
  };

  return positions.length > 1 ? (
    <Polyline positions={positions} pathOptions={pathOptions} />
  ) : null;
};

export default AircraftTrail;
