// EnhancedAircraftMarker.tsx
import React, { useEffect, useState } from 'react';
import { Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import type { Aircraft } from '../../types/base';
import {
  createAircraftIcon,
  createTooltipContent,
  createPopupContent,
} from '../tracking/map/AircraftIcon/AircraftIcon';

interface EnhancedAircraftMarkerProps {
  aircraft: Aircraft & {
    type?: string;
    isGovernment?: boolean;
    registration?: string;
    'N-NUMBER'?: string;
    TYPE_AIRCRAFT?: string;
    manufacturer?: string;
    CITY?: string;
    STATE?: string;
    OWNER_TYPE?: string;
    owner?: string;
  };
  isSelected?: boolean;
  onClick?: (aircraft: Aircraft) => void;
}

export const EnhancedAircraftMarker: React.FC<EnhancedAircraftMarkerProps> = ({
  aircraft,
  isSelected = false,
  onClick,
}) => {
  const map = useMap();
  const [zoomLevel, setZoomLevel] = useState(map.getZoom());

  // Track zoom level changes
  useEffect(() => {
    const handleZoomChange = () => {
      setZoomLevel(map.getZoom());
    };

    map.on('zoom', handleZoomChange);

    return () => {
      map.off('zoom', handleZoomChange);
      console.log('[Marker] Cleaning up marker for:', aircraft.icao24);
    };
  }, [aircraft.icao24, map]);

  if (!aircraft?.latitude || !aircraft?.longitude) return null;

  // Create the icon using the responsive function with current zoom level
  const icon = createAircraftIcon(aircraft, {
    isSelected,
    zoomLevel,
  });

  const handleClick = () => {
    if (onClick) {
      onClick(aircraft);
    }
  };

  return (
    <Marker
      position={[aircraft.latitude, aircraft.longitude]}
      icon={icon || undefined} // Convert null to undefined
      eventHandlers={{
        click: handleClick,
      }}
      zIndexOffset={isSelected ? 1000 : 0}
    >
      {/* Responsive tooltip with dynamic content based on zoom level */}
      <Tooltip
        direction="top"
        offset={[0, -20]}
        opacity={0.9}
        className="aircraft-tooltip"
        permanent={isSelected && zoomLevel > 8}
      >
        <div
          dangerouslySetInnerHTML={{
            __html: createTooltipContent(aircraft, zoomLevel),
          }}
        />
      </Tooltip>

      {/* Detailed popup with responsive content based on zoom level */}
      <Popup className="aircraft-popup">
        <div
          dangerouslySetInnerHTML={{
            __html: createPopupContent(aircraft, zoomLevel),
          }}
        />
      </Popup>
    </Marker>
  );
};

export default React.memo(EnhancedAircraftMarker);
