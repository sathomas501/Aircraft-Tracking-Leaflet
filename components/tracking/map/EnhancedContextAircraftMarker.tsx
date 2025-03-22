// components/tracking/map/components/EnhancedContextAircraftMarker.tsx
import React, { useRef, useEffect, memo, useState } from 'react';
import { Marker, Popup, Tooltip } from 'react-leaflet';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import { createAircraftIcon } from '../../../components/aircraft/tracking/Map/components/AircraftIcon/AircraftIcon';
import type { ExtendedAircraft } from '@/types/base';
import L from 'leaflet';

interface EnhancedContextAircraftMarkerProps {
  aircraft: ExtendedAircraft;
}

// Only render popup content when aircraft is selected
const AircraftPopup: React.FC<{ aircraft: ExtendedAircraft }> = memo(
  ({ aircraft }) => {
    // Memoize these calculations to prevent recalculating on every render
    const formattedData = React.useMemo(() => {
      // Format altitude with commas for thousands
      const formattedAltitude = aircraft.altitude
        ? Math.round(aircraft.altitude).toLocaleString() + ' ft'
        : 'N/A';

      // Format speed
      const formattedSpeed = aircraft.velocity
        ? Math.round(aircraft.velocity) + ' kts'
        : 'N/A';

      // Format heading with direction
      const formatHeading = (heading: number) => {
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const index = Math.round((heading % 360) / 45) % 8;
        return `${Math.round(heading)}° ${directions[index]}`;
      };

      // Registration or N-Number display (with fallbacks)
      const registration =
        aircraft.registration || aircraft['N-NUMBER'] || aircraft.icao24;

      const headingFormatted = aircraft.heading
        ? formatHeading(aircraft.heading)
        : 'Unknown';

      return {
        formattedAltitude,
        formattedSpeed,
        headingFormatted,
        registration,
        model: aircraft.model || aircraft.TYPE_AIRCRAFT || 'Unknown',
        manufacturer: aircraft.manufacturer || 'Unknown',
        location:
          aircraft.CITY || aircraft.STATE
            ? [aircraft.CITY, aircraft.STATE].filter(Boolean).join(', ')
            : null,
      };
    }, [
      aircraft.altitude,
      aircraft.velocity,
      aircraft.heading,
      aircraft.registration,
      aircraft['N-NUMBER'],
      aircraft.icao24,
      aircraft.model,
      aircraft.TYPE_AIRCRAFT,
      aircraft.manufacturer,
      aircraft.CITY,
      aircraft.STATE,
    ]);

    return (
      <Popup className="aircraft-popup">
        <div className="p-1">
          <table className="w-full text-sm border-collapse">
            <tbody>
              <tr>
                <td className="font-medium pr-2">Model:</td>
                <td>{formattedData.model}</td>
              </tr>
              <tr>
                <td className="font-medium pr-2">Manufacturer:</td>
                <td>{formattedData.manufacturer}</td>
              </tr>
              <tr>
                <td className="font-medium pr-2">Altitude:</td>
                <td>{formattedData.formattedAltitude}</td>
              </tr>
              <tr>
                <td className="font-medium pr-2">Speed:</td>
                <td>{formattedData.formattedSpeed}</td>
              </tr>
              <tr>
                <td className="font-medium pr-2">Heading:</td>
                <td>{formattedData.headingFormatted}</td>
              </tr>
              <tr>
                <td className="font-medium pr-2">Registration:</td>
                <td>{formattedData.registration}</td>
              </tr>
              <tr>
                <td className="font-medium pr-2">ICAO:</td>
                <td>{aircraft.icao24}</td>
              </tr>
              {aircraft.owner && (
                <tr>
                  <td className="font-medium pr-2">Owner:</td>
                  <td>{aircraft.owner}</td>
                </tr>
              )}
              {formattedData.location && (
                <tr>
                  <td className="font-medium pr-2">Location:</td>
                  <td>{formattedData.location}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Popup>
    );
  }
);

// Only render tooltip when hovered
const AircraftTooltip: React.FC<{ aircraft: ExtendedAircraft }> = memo(
  ({ aircraft }) => {
    // Simple, lightweight tooltip with minimal data
    const model = aircraft.model || aircraft.TYPE_AIRCRAFT || 'Unknown';
    const altitude = aircraft.altitude
      ? Math.round(aircraft.altitude).toLocaleString() + ' ft'
      : 'N/A';
    const speed = aircraft.velocity
      ? Math.round(aircraft.velocity) + ' kts'
      : 'N/A';

    return (
      <Tooltip
        direction="top"
        offset={[0, -20]}
        opacity={0.9}
        className="aircraft-tooltip"
      >
        <div className="p-1">
          <div className="text-xs font-bold">{model}</div>
          <div className="grid grid-cols-2 gap-x-2 text-xs mt-1">
            <div>Alt: {altitude}</div>
            <div>Speed: {speed}</div>
          </div>
        </div>
      </Tooltip>
    );
  }
);

// The main aircraft marker component
const EnhancedContextAircraftMarker: React.FC<
  EnhancedContextAircraftMarkerProps
> = ({ aircraft }) => {
  const { selectedAircraft, selectAircraft, zoomLevel } =
    useEnhancedMapContext();
  const isSelected = selectedAircraft?.icao24 === aircraft.icao24;
  const markerRef = useRef<L.Marker>(null);
  const [isHovering, setIsHovering] = useState(false);

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

  // Direct DOM manipulation for better performance
  useEffect(() => {
    if (!markerRef.current) return;

    const marker = markerRef.current;

    if ('getLatLng' in marker) {
      try {
        // Update position directly
        marker.setLatLng([aircraft.latitude, aircraft.longitude]);

        // Update icon if heading changed significantly
        if (aircraft.heading !== undefined && icon) {
          // Add check for icon not being null
          const currentIcon = marker.getIcon();
          if (currentIcon !== icon) {
            marker.setIcon(icon);
          }
        }
      } catch (error) {
        console.error('Error updating marker:', error);
      }
    }
  }, [aircraft.latitude, aircraft.longitude, aircraft.heading, icon]);

  // Optimize event handlers
  const eventHandlers = React.useMemo(
    () => ({
      click: () => selectAircraft(aircraft),
      mouseover: () => setIsHovering(true),
      mouseout: () => setIsHovering(false),
    }),
    [aircraft, selectAircraft]
  );

  return (
    <Marker
      ref={markerRef}
      position={[aircraft.latitude, aircraft.longitude]}
      icon={icon || undefined}
      eventHandlers={eventHandlers}
      zIndexOffset={isSelected ? 1000 : 0}
    >
      {/* Only render Tooltip when hovering */}
      {isHovering && <AircraftTooltip aircraft={aircraft} />}

      {/* Only render Popup when selected */}
      {isSelected && <AircraftPopup aircraft={aircraft} />}
    </Marker>
  );
};

// Custom comparison function for memo to prevent unnecessary re-renders
const areEqual = (
  prevProps: EnhancedContextAircraftMarkerProps,
  nextProps: EnhancedContextAircraftMarkerProps
) => {
  const prev = prevProps.aircraft;
  const next = nextProps.aircraft;

  // Only re-render if position changed significantly
  const positionChanged =
    Math.abs(prev.latitude - next.latitude) > 0.0001 ||
    Math.abs(prev.longitude - next.longitude) > 0.0001;

  // Only re-render if heading changed by more than 5 degrees
  const headingChanged =
    prev.heading && next.heading
      ? Math.abs(prev.heading - next.heading) > 5
      : prev.heading !== next.heading;

  // Same ICAO = same aircraft
  const isSameAircraft = prev.icao24 === next.icao24;

  // Only re-render if position or heading changed significantly
  return isSameAircraft && !positionChanged && !headingChanged;
};

export default memo(EnhancedContextAircraftMarker, areEqual);
