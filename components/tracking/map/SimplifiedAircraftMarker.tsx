// components/tracking/map/SimplifiedAircraftMarker.tsx
import React, { useMemo } from 'react';
import { Marker } from 'react-leaflet';
import type { ExtendedAircraft } from '@/types/base';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import { useEnhancedUI } from '../context/EnhancedUIContext';
import { createAircraftIcon } from './AircraftIcon/AircraftIcon';
import { useAircraftTooltip } from '../context/AircraftTooltipContext';
import AircraftTooltipComponent from './components/AircraftTooltipComponent';
import AircraftInfoPanel from './components/AircraftInfoPanel';

interface SimplifiedAircraftMarkerProps {
  aircraft: ExtendedAircraft;
  isStale?: boolean;
  onClick?: () => void; // Make it optional with ?
}

/**
 * Simplified Aircraft Marker Component
 * This component only handles marker rendering and events
 * Tooltips and popups are delegated to specialized components
 */
const SimplifiedAircraftMarker: React.FC<SimplifiedAircraftMarkerProps> = ({
  aircraft,
  isStale = false,
  onClick,
}) => {
  const { selectedAircraft, zoomLevel } = useEnhancedMapContext();
  const { selectAircraft } = useEnhancedUI();
  const {
    showTooltip,
    hideTooltip,
    showPopup,
    hidePopup,
    setIsPermanentTooltip,
  } = useAircraftTooltip();

  // Determine if this aircraft is selected
  const isSelected = selectedAircraft?.ICAO24 === aircraft.ICAO24;

  // Ensure aircraft has ICAO24
  const aircraftId = aircraft.ICAO24 || '';

  // Validate position data
  if (!aircraft.latitude || !aircraft.longitude || !aircraftId) {
    return null;
  }

  // Create position array safely with validations
  // Get position from either property naming convention
  const lat =
    typeof aircraft.latitude === 'number'
      ? aircraft.latitude
      : typeof (aircraft as any).lat === 'number'
        ? (aircraft as any).lat
        : 0;

  const lng =
    typeof aircraft.longitude === 'number'
      ? aircraft.longitude
      : typeof (aircraft as any).lng === 'number'
        ? (aircraft as any).lng
        : 0;

  // Create position array
  const position: [number, number] = [lat, lng];

  // Create icon for the marker
  const aircraftIcon = useMemo(() => {
    return createAircraftIcon(aircraft, {
      isSelected,
      zoomLevel,
    });
  }, [aircraft, isSelected, zoomLevel]);

  // Event handlers
  const handleMarkerClick = () => {
    // Pass the aircraft to the UI context for selection
    selectAircraft(aircraft);

    // Show popup for this aircraft
    showPopup({
      ...aircraft,
      zoomLevel,
    });

    // Important: Make the tooltip permanent to prevent it from disappearing
    setIsPermanentTooltip(true);
  };

  const handleMouseOver = () => {
    // Add zoom level to aircraft for tooltip rendering
    const aircraftWithZoom = {
      ...aircraft,
      zoomLevel,
    };

    // Show tooltip and make it permanent
    showTooltip(aircraftWithZoom);
    setIsPermanentTooltip(true);
  };

  const handleMouseOut = () => {
    // Hide tooltip for this specific aircraft
    hideTooltip(aircraftId);
    setIsPermanentTooltip(false);
  };

  return (
    <>
      <Marker
        position={position}
        icon={aircraftIcon || undefined}
        zIndexOffset={isSelected ? 1000 : 0}
        eventHandlers={{
          click: handleMarkerClick,
          mouseover: handleMouseOver,
          mouseout: handleMouseOut,
        }}
      >
        {/* Each marker has its own tooltip and popup component */}
        <AircraftTooltipComponent aircraft={aircraft} isStale={isStale} />
        <AircraftInfoPanel aircraft={aircraft} />
      </Marker>
    </>
  );
};

// Use memo to prevent unnecessary re-renders
export default React.memo(SimplifiedAircraftMarker);
