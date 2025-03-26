// components/tracking/map/components/EnhancedContextAircraftInfoPanel.tsx

import React, { useRef, useState, useEffect, memo } from 'react';
import { useEnhancedMapContext } from '../../context/EnhancedMapContext';

// Helper function to convert owner type codes to readable labels
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

const EnhancedContextAircraftInfoPanel: React.FC = () => {
  const { selectedAircraft, selectAircraft, zoomLevel } =
    useEnhancedMapContext();
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag state management - same as in EnhancedUnifiedSelector
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Initialize position when aircraft is selected
  useEffect(() => {
    if (selectedAircraft && !position.x && !position.y) {
      // Position at top-right by default
      setPosition({
        x: window.innerWidth - (containerRef.current?.offsetWidth || 275) - 20,
        y: 20,
      });
    }
  }, [selectedAircraft]);

  // Reset position when aircraft changes
  useEffect(() => {
    setPosition({
      x: window.innerWidth - (containerRef.current?.offsetWidth || 275) - 20,
      y: 20,
    });
  }, [selectedAircraft?.icao24]);

  // Handle mouse movement for dragging - same as in EnhancedUnifiedSelector
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: Math.max(0, e.clientX - dragOffset.x),
          y: Math.max(0, e.clientY - dragOffset.y),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'grabbing';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
  }, [isDragging, dragOffset]);

  // Start dragging - same as in EnhancedUnifiedSelector
  const startDragging = (e: React.MouseEvent) => {
    if (
      e.target === containerRef.current ||
      (e.target as HTMLElement).closest('.drag-handle')
    ) {
      e.preventDefault();
      setIsDragging(true);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    }
  };

  if (!selectedAircraft) return null;

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
      ref={containerRef}
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 1000,
        maxWidth: '275px',
        maxHeight: 'calc(100vh - 40px)',
        overflow: 'auto',
      }}
      className="bg-white rounded-lg shadow-lg p-4"
    >
      {/* Header with centered registration and close button - made dragable */}
      <div
        className="flex justify-between items-center mb-3 drag-handle cursor-grab"
        onMouseDown={startDragging}
      >
        <div className="flex-grow text-center">
          <h2 className="text-xl font-bold">{registration}</h2>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent drag trigger
            selectAircraft(null);
          }}
          className="p-1 hover:bg-gray-100 rounded-full flex-shrink-0 ml-2"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

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
              {selectedAircraft.model || selectedAircraft.TYPE_AIRCRAFT || '45'}
            </td>
          </tr>
          <tr>
            <td className="py-1 text-gray-600 font-medium">Manufacturer:</td>
            <td className="py-1">
              {selectedAircraft.manufacturer || 'LEARJET INC'}
            </td>
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
    </div>
  );
};

export default EnhancedContextAircraftInfoPanel;
