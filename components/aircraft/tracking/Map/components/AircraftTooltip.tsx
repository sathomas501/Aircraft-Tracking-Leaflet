// components/aircraft/tracking/Map/components/AircraftTooltip.tsx
import React from 'react';
import { Aircraft } from '@/types/base';

interface AircraftTooltipProps {
  aircraft: Aircraft;
}

export const AircraftTooltip: React.FC<AircraftTooltipProps> = ({
  aircraft,
}) => {
  if (!aircraft) return null;

  // Format altitude with commas for thousands
  const formattedAltitude = aircraft.altitude
    ? Math.round(aircraft.altitude).toLocaleString() + ' ft'
    : 'N/A';

  // Format speed
  const formattedSpeed = aircraft.velocity
    ? Math.round(aircraft.velocity) + ' kts'
    : 'N/A';

  // Get registration with fallbacks
  const registration =
    aircraft.registration || aircraft['N-NUMBER'] || aircraft.icao24;

  return (
    <div className="aircraft-tooltip p-2 min-w-[180px]">
      <div className="flex justify-between items-start">
        {aircraft.TYPE_AIRCRAFT && (
          <div className="text-xs px-1 bg-gray-100 rounded">
            {aircraft.TYPE_AIRCRAFT}
          </div>
        )}
      </div>

      <div className="text-xs font-medium mt-1">
        {aircraft.model || 'Unknown'}
      </div>

      <div className="grid grid-cols-2 gap-x-2 text-xs mt-2">
        <div>
          Alt: <span className="font-medium">{formattedAltitude}</span>
        </div>
        <div>
          Speed: <span className="font-medium">{formattedSpeed}</span>
        </div>

        {aircraft.heading && (
          <div className="col-span-2 mt-1">
            Heading:{' '}
            <span className="font-medium">{Math.round(aircraft.heading)}°</span>
          </div>
        )}

        {aircraft.manufacturer && (
          <div className="col-span-2 mt-1">{aircraft.manufacturer}</div>
        )}

        {aircraft.owner && (
          <div className="col-span-2 mt-1 text-gray-600">
            Owner: {aircraft.owner}
          </div>
        )}
      </div>

      {/* Show last update time if available */}
      {aircraft.lastSeen && (
        <div className="text-xs text-gray-400 mt-2">
          Updated: {new Date(aircraft.lastSeen).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

export default React.memo(AircraftTooltip);
