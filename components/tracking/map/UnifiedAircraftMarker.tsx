// components/tracking/map/UnifiedAircraftMarker.tsx
import React, { useMemo } from 'react';
import { Marker, Tooltip, Popup } from 'react-leaflet';
import L from 'leaflet';
import { ExtendedAircraft } from '@/types/base';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import { useEnhancedUI } from '../../tracking/context/EnhancedUIContext';
import {
  createAircraftIcon,
  createTooltipContent,
  createPopupContent,
  getIconSizeForZoom,
  getTooltipFontSize,
} from '../../tracking/map/AircraftIcon/AircraftIcon';

interface UnifiedAircraftMarkerProps {
  aircraft: ExtendedAircraft;
  onMarkerClick?: (aircraft: ExtendedAircraft) => void;
}

const UnifiedAircraftMarker: React.FC<UnifiedAircraftMarkerProps> = ({
  aircraft,
  onMarkerClick,
}) => {
  const { selectedAircraft, zoomLevel } = useEnhancedMapContext();
  const { selectAircraft } = useEnhancedUI();

  // Determine if this aircraft is selected
  const isSelected = selectedAircraft?.icao24 === aircraft.icao24;

  // Create memo-ized marker icon using the imported functions
  const aircraftIcon = useMemo(() => {
    // Use the imported createAircraftIcon function
    return createAircraftIcon(aircraft, {
      isSelected,
      zoomLevel,
    });
  }, [aircraft, isSelected, zoomLevel]);

  // Create position array safely with validations
  const position: [number, number] = [
    typeof aircraft.latitude === 'number' ? aircraft.latitude : 0,
    typeof aircraft.longitude === 'number' ? aircraft.longitude : 0,
  ];

  // Event handlers
  const handleMarkerClick = () => {
    selectAircraft(aircraft);
    if (onMarkerClick) onMarkerClick(aircraft);
  };

  // Create tooltip content using imported function
  const tooltipContent = useMemo(() => {
    // Show tooltips only at certain zoom levels
    if (zoomLevel < 7) return null;

    return createTooltipContent(aircraft, zoomLevel);
  }, [aircraft, zoomLevel]);

  // Return null if icon creation failed (SSR guard)
  if (!aircraftIcon) return null;

  // Check if we should show a tooltip for this aircraft
  const shouldShowTooltip = tooltipContent && zoomLevel >= 7 && !isSelected;

  return (
    <Marker
      position={position}
      icon={aircraftIcon}
      eventHandlers={{
        click: handleMarkerClick,
      }}
      zIndexOffset={isSelected ? 1000 : 0}
    >
      {/* Only render tooltip if content exists and conditions are met */}
      {shouldShowTooltip && (
        <Tooltip
          direction="top"
          className="aircraft-tooltip"
          opacity={0.9}
          offset={[0, -5] as L.PointTuple}
        >
          <div dangerouslySetInnerHTML={{ __html: tooltipContent as string }} />
        </Tooltip>
      )}
    </Marker>
  );
};

export default React.memo(UnifiedAircraftMarker);
