// components/tracking/panels/UnifiedAircraftInfoPanel.tsx
import React from 'react';
import DraggablePanel from '../../DraggablePanel';
import { useEnhancedUI } from '../../../tracking/context/EnhancedUIContext';

// Helper function to convert owner type cod/es to readable labels
function getOwnerTypeLabel(ownerType: string): string {
  const ownerTypes: Record<string, string> = {
    '1': 'Individual',
    '2': 'Partnership',
    '3': 'Corp.',
    '4': 'Co-Owned',
    '5': 'Government',
    '7': 'LLC',
    '8': 'Non-Citizen Corporation',
    '9': 'Non-Citizen Co-Owned',
  };
  return ownerTypes[ownerType] || `Type ${ownerType}`;
}

const UnifiedAircraftInfoPanel: React.FC = () => {
  const { panels, closePanel, setPanelPosition, selectedAircraft } =
    useEnhancedUI();
  const { isOpen, position } = panels.aircraftInfo;

  const handleClose = () => {
    closePanel('aircraftInfo');
  };

  if (!selectedAircraft || !isOpen) return null;

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
    <DraggablePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={registration}
      initialPosition={position}
      maxWidth="275px"
      maxHeight="calc(100vh - 40px)"
      zIndex={1000}
      className="bg-white rounded-lg shadow-lg"
      bodyClassName=""
      headerClassName="flex justify-between items-center mb-3 cursor-grab"
    >
      {/* Aircraft details */}
      <table className="w-full text-sm">
        <tbody>
          <tr>
            <td
              className="py-1 text-gray-600 font-medium"
              style={{ width: '40%' }}
            >
              Model:
            </td>
            <td className="py-1">
              {selectedAircraft.model ||
                selectedAircraft.TYPE_AIRCRAFT ||
                'N/A'}
            </td>
          </tr>
          <tr>
            <td className="py-1 text-gray-600 font-medium">Manufacturer:</td>
            <td className="py-1">{selectedAircraft.manufacturer || 'N/A'}</td>
          </tr>
          <tr>
            <td className="py-1 text-gray-600 font-medium">Altitude:</td>
            <td className="py-1">{formattedAltitude}</td>
          </tr>
          <tr>
            <td className="py-1 text-gray-600 font-medium">Speed:</td>
            <td className="py-1">{formattedSpeed}</td>
          </tr>
          {selectedAircraft.heading !== undefined && (
            <tr>
              <td className="py-1 text-gray-600 font-medium">Heading:</td>
              <td className="py-1">{Math.round(selectedAircraft.heading)}°</td>
            </tr>
          )}
          {/* Owner information */}
          {selectedAircraft.NAME && (
            <tr>
              <td className="py-1 text-gray-600 font-medium">Name:</td>
              <td className="py-1">{selectedAircraft.NAME}</td>
            </tr>
          )}
          {/* Location information */}
          {(selectedAircraft.CITY || selectedAircraft.STATE) && (
            <tr>
              <td className="py-1 text-gray-600 font-medium">Location:</td>
              <td className="py-1">
                {[selectedAircraft.CITY, selectedAircraft.STATE]
                  .filter(Boolean)
                  .join(', ')}
              </td>
            </tr>
          )}
          {selectedAircraft.OWNER_TYPE && (
            <tr>
              <td className="py-1 text-gray-600 font-medium">Owner Type:</td>
              <td className="py-1">
                {getOwnerTypeLabel(selectedAircraft.OWNER_TYPE)}
              </td>
            </tr>
          )}
          {selectedAircraft.on_ground !== undefined && (
            <tr>
              <td className="py-1 text-gray-600 font-medium">Status:</td>
              <td className="py-1">
                <span
                  className={`px-2 py-0.5 ${selectedAircraft.on_ground ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'} rounded-full text-xs`}
                >
                  {selectedAircraft.on_ground ? 'On Ground' : 'In Flight'}
                </span>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* View Details button */}
      <div className="mt-3 text-center">
        <button
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1 rounded text-sm transition-colors"
          onClick={(e) => {
            e.stopPropagation(); // Prevent drag trigger
            console.log('View details for:', selectedAircraft.icao24);
          }}
        >
          View Details
        </button>
      </div>
    </DraggablePanel>
  );
};

export default UnifiedAircraftInfoPanel;
