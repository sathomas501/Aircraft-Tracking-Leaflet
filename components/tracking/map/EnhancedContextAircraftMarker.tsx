// EnhancedContextAircraftMarker.tsx - Update to fix tooltip issue while preventing flickering

import React, { useRef, useEffect, useState, memo } from 'react';
import { Marker, Popup, Tooltip } from 'react-leaflet';
import { useEnhancedMapContext } from '../../tracking/context/EnhancedMapContext';
import { createAircraftIcon } from '../map/AircraftIcon/AircraftIcon';
import type { ExtendedAircraft } from '@/types/base';
import L from 'leaflet';
import AircraftTrail from '../map/components/AircraftTrail';

interface EnhancedContextAircraftMarkerProps {
  aircraft: ExtendedAircraft;
}

// The key change is to move tooltips to a separate component with its own marker
// This prevents the tooltip error while maintaining our anti-flicker protection

const EnhancedContextAircraftMarker: React.FC<
  EnhancedContextAircraftMarkerProps
> = ({ aircraft }) => {
  const {
    selectedAircraft,
    selectAircraft,
    zoomLevel,
    trailsEnabled,
    aircraftTrails,
  } = useEnhancedMapContext();

  const isSelected = selectedAircraft?.icao24 === aircraft.icao24;
  const markerRef = useRef<L.Marker>(null);
  const interactionRef = useRef<L.Marker>(null);
  const [isHovering, setIsHovering] = useState(false);

  // Get the trail for this aircraft
  const trail =
    trailsEnabled && aircraftTrails && aircraftTrails.get
      ? aircraftTrails.get(aircraft.icao24)
      : undefined;

  // Skip rendering if no valid position
  if (!aircraft?.latitude || !aircraft?.longitude) return null;

  // Only create icon when needed attributes change
  const icon = React.useMemo(
    () =>
      createAircraftIcon(aircraft, {
        isSelected,
        zoomLevel: zoomLevel || 9,
      }),
    [aircraft.icao24, aircraft.heading, isSelected, zoomLevel]
  );

  // Create a simple touch target icon (transparent)
  const touchIcon = React.useMemo(() => {
    if (typeof window === 'undefined') return null;

    return L.divIcon({
      className: 'aircraft-touch-area', // This class should have pointer-events: auto in CSS
      html: `<div style="width: 44px; height: 44px;"></div>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
  }, []);

  // Event handlers just for the interaction marker
  const interactionHandlers = React.useMemo(
    () => ({
      click: () => selectAircraft(aircraft),
      mouseover: () => setIsHovering(true),
      mouseout: () => setIsHovering(false),
    }),
    [aircraft, selectAircraft]
  );

  return (
    <>
      {/* Render trail if enabled */}
      {trailsEnabled && trail && trail.length >= 2 && (
        <AircraftTrail
          positions={trail}
          color={isSelected ? '#3388ff' : '#3388ff80'} // Blue, more transparent if not selected
          weight={isSelected ? 3 : 2}
          opacity={isSelected ? 0.9 : 0.65}
          zIndexOffset={isSelected ? 900 : 0} // Below aircraft but above other trails
          fadeEffect={true}
          selected={isSelected}
        />
      )}

      {/* Visual marker - completely non-interactive */}
      <Marker
        ref={markerRef}
        position={[aircraft.latitude, aircraft.longitude]}
        icon={icon || undefined}
        zIndexOffset={isSelected ? 1000 : 0}
        interactive={false} // This is key - no interaction on the visual marker
      />

      {/* Interaction marker - invisible but handles clicks and hovers */}
      <Marker
        ref={interactionRef}
        position={[aircraft.latitude, aircraft.longitude]}
        icon={touchIcon || undefined}
        eventHandlers={interactionHandlers}
        zIndexOffset={isSelected ? 999 : -1} // Just below the visual marker for proper layering
      >
        {/* IMPORTANT: Instead of conditional rendering, always include Tooltip but control visibility with CSS */}
        <Tooltip
          direction="top"
          offset={[0, -20]}
          opacity={isHovering ? 0.9 : 0} // Use opacity to control visibility
          className={`aircraft-tooltip ${isHovering ? 'visible' : 'hidden'}`}
          permanent={false}
        >
          <div className="p-1">
            <div className="text-xs font-bold">
              {aircraft.model || aircraft.TYPE_AIRCRAFT || 'Unknown'}
            </div>
            <div className="grid grid-cols-2 gap-x-2 text-xs mt-1">
              <div>
                Alt:{' '}
                {aircraft.altitude
                  ? Math.round(aircraft.altitude).toLocaleString() + ' ft'
                  : 'N/A'}
              </div>
              <div>
                Speed:{' '}
                {aircraft.velocity
                  ? Math.round(aircraft.velocity) + ' kts'
                  : 'N/A'}
              </div>
            </div>
          </div>
        </Tooltip>

        {/* Only render Popup when selected */}
        {isSelected && <AircraftPopup aircraft={aircraft} />}
      </Marker>
    </>
  );
};

// You would still use your existing AircraftPopup component
const AircraftPopup = memo<{ aircraft: ExtendedAircraft }>(({ aircraft }) => {
  // Your existing popup implementation
  return (
    <Popup className="aircraft-popup">
      {/* Your popup content */}
      <div>Aircraft details...</div>
    </Popup>
  );
});

AircraftPopup.displayName = 'AircraftPopup';

export default memo(EnhancedContextAircraftMarker);
