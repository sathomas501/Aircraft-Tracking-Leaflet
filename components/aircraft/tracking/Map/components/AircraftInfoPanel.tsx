// components/aircraft/tracking/Map/components/AircraftInfoPanel.tsx
import React from 'react';
import { X } from 'lucide-react';
import { Aircraft } from '@/types/base';

interface AircraftInfoPanelProps {
  aircraft: Aircraft | null;
  onClose: () => void;
}

export const AircraftInfoPanel: React.FC<AircraftInfoPanelProps> = ({
  aircraft,
  onClose,
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

  // Registration or N-Number display (with fallbacks)
  const registration =
    aircraft.registration || aircraft['N-NUMBER'] || aircraft.icao24;

  // Format date if available
  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-30 max-w-md">
      <div className="flex justify-between items-start mb-2">
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-full"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      <div className="mb-3">
        <span className="font-medium">
          {aircraft.model || aircraft.TYPE_AIRCRAFT || 'Unknown'}
        </span>
        {aircraft.manufacturer && (
          <span className="ml-2 text-gray-600">{aircraft.manufacturer}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-xs text-gray-500">Altitude</div>
          <div className="font-medium">{formattedAltitude}</div>
        </div>
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-xs text-gray-500">Speed</div>
          <div className="font-medium">{formattedSpeed}</div>
        </div>
        {aircraft.heading !== undefined && (
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-xs text-gray-500">Heading</div>
            <div className="font-medium">{Math.round(aircraft.heading)}°</div>
          </div>
        )}
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-xs text-gray-500">ICAO24</div>
          <div className="font-medium font-mono">{aircraft.icao24}</div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-3">
        <h3 className="font-medium mb-2">Aircraft Details</h3>
        <table className="w-full text-sm">
          <tbody>
            {registration && (
              <tr>
                <td className="py-1 text-gray-500">Registration</td>
                <td className="py-1 font-medium">{registration}</td>
              </tr>
            )}
            {aircraft.owner && (
              <tr>
                <td className="py-1 text-gray-500">Owner</td>
                <td className="py-1">{aircraft.owner}</td>
              </tr>
            )}
            {aircraft.CITY && aircraft.STATE && (
              <tr>
                <td className="py-1 text-gray-500">Location</td>
                <td className="py-1">
                  {aircraft.CITY}, {aircraft.STATE}
                </td>
              </tr>
            )}
            {aircraft.OWNER_TYPE && (
              <tr>
                <td className="py-1 text-gray-500">Owner Type</td>
                <td className="py-1">
                  {getOwnerTypeLabel(aircraft.OWNER_TYPE)}
                </td>
              </tr>
            )}
            {aircraft.lastSeen && (
              <tr>
                <td className="py-1 text-gray-500">Last Seen</td>
                <td className="py-1">{formatDate(aircraft.lastSeen)}</td>
              </tr>
            )}
            {aircraft.on_ground !== undefined && (
              <tr>
                <td className="py-1 text-gray-500">Status</td>
                <td className="py-1">
                  {aircraft.on_ground ? (
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full text-xs">
                      On Ground
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">
                      In Flight
                    </span>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {aircraft.latitude && aircraft.longitude && (
        <div className="mt-2 text-xs text-gray-500">
          Position: {aircraft.latitude.toFixed(4)},{' '}
          {aircraft.longitude.toFixed(4)}
        </div>
      )}
    </div>
  );
};

// Helper function to convert owner type codes to readable labels
function getOwnerTypeLabel(ownerType: string): string {
  const ownerTypes: Record<string, string> = {
    '1': 'Individual',
    '2': 'Partnership',
    '3': 'Corporation',
    '4': 'Co-Owned',
    '5': 'Government',
    '8': 'Non-Citizen Corporation',
    '9': 'Non-Citizen Co-Owned',
  };
  return ownerTypes[ownerType] || `Type ${ownerType}`;
}

export default React.memo(AircraftInfoPanel);
