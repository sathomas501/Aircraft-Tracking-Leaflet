// components/tracking/map/components/ContextAircraftInfoPanel.tsx
import React from 'react';
import { useMapContext } from '../../context/MapContext';
import type { ExtendedAircraft } from '@/types/base';

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

const ContextAircraftInfoPanel: React.FC = () => {
  const { selectedAircraft, selectAircraft, zoomLevel } = useMapContext();

  if (!selectedAircraft) return null;

  // Adjust panel style based on zoom level
  const infoPanelStyle = {
    maxWidth: zoomLevel >= 10 ? '350px' : '300px',
    maxHeight: '85vh',
    overflow: 'auto',
    transition: 'max-width 0.3s ease-in-out',
  };

  // Format altitude with commas for thousands
  const formattedAltitude = selectedAircraft.altitude
    ? Math.round(selectedAircraft.altitude).toLocaleString() + ' ft'
    : 'N/A';

  // Format speed
  const formattedSpeed = selectedAircraft.velocity
    ? Math.round(selectedAircraft.velocity) + ' kts'
    : 'N/A';

  // Registration or N-Number display (with fallbacks)
  const registration =
    selectedAircraft.registration ||
    selectedAircraft['N-NUMBER'] ||
    selectedAircraft.icao24;

  return (
    <div
      className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-30"
      style={infoPanelStyle}
    >
      <div className="flex justify-between items-start mb-2">
        <h2 className="text-xl font-bold">{registration}</h2>
        <button
          onClick={() => selectAircraft(null)}
          className="p-1 hover:bg-gray-100 rounded-full"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="mb-3">
        <span
          className="font-medium"
          style={{ fontSize: zoomLevel >= 10 ? '1rem' : '0.875rem' }}
        >
          {selectedAircraft.model ||
            selectedAircraft.TYPE_AIRCRAFT ||
            'Unknown'}
        </span>
        {selectedAircraft.manufacturer && (
          <span className="ml-2 text-gray-600">
            {selectedAircraft.manufacturer}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-xs text-gray-500">Altitude</div>
          <div
            className="font-medium"
            style={{ transition: 'font-size 0.2s ease' }}
          >
            {formattedAltitude}
          </div>
        </div>
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-xs text-gray-500">Speed</div>
          <div className="font-medium">{formattedSpeed}</div>
        </div>
        {selectedAircraft.heading !== undefined && (
          <div className="bg-gray-50 p-2 rounded">
            <div className="text-xs text-gray-500">Heading</div>
            <div className="font-medium">
              {Math.round(selectedAircraft.heading)}°
            </div>
          </div>
        )}
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-xs text-gray-500">ICAO24</div>
          <div className="font-medium font-mono">{selectedAircraft.icao24}</div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-3">
        <h3 className="font-medium mb-2">Aircraft Details</h3>
        <table className="w-full text-sm">
          <tbody>
            {(selectedAircraft.registration ||
              selectedAircraft['N-NUMBER']) && (
              <tr>
                <td className="py-1 text-gray-500">Registration</td>
                <td className="py-1 font-medium">
                  {selectedAircraft.registration ||
                    selectedAircraft['N-NUMBER']}
                </td>
              </tr>
            )}
            {selectedAircraft.owner && (
              <tr>
                <td className="py-1 text-gray-500">Owner</td>
                <td className="py-1">{selectedAircraft.owner}</td>
              </tr>
            )}
            {selectedAircraft.CITY && selectedAircraft.STATE && (
              <tr>
                <td className="py-1 text-gray-500">Location</td>
                <td className="py-1">
                  {selectedAircraft.CITY}, {selectedAircraft.STATE}
                </td>
              </tr>
            )}
            {selectedAircraft.OWNER_TYPE && (
              <tr>
                <td className="py-1 text-gray-500">Owner Type</td>
                <td className="py-1">
                  {getOwnerTypeLabel(selectedAircraft.OWNER_TYPE)}
                </td>
              </tr>
            )}
            {selectedAircraft.lastSeen && (
              <tr>
                <td className="py-1 text-gray-500">Last Seen</td>
                <td className="py-1">
                  {new Date(selectedAircraft.lastSeen).toLocaleTimeString()}
                </td>
              </tr>
            )}
            {selectedAircraft.on_ground !== undefined && (
              <tr>
                <td className="py-1 text-gray-500">Status</td>
                <td className="py-1">
                  {selectedAircraft.on_ground ? (
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

      {selectedAircraft.latitude && selectedAircraft.longitude && (
        <div className="mt-2 text-xs text-gray-500">
          Position: {selectedAircraft.latitude.toFixed(4)},{' '}
          {selectedAircraft.longitude.toFixed(4)}
        </div>
      )}
    </div>
  );
};

export default ContextAircraftInfoPanel;
