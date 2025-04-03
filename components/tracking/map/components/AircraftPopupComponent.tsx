// components/tracking/map/components/AircraftPopupComponent.tsx
import React, { FC } from 'react';
import { Popup } from 'react-leaflet';
import { useAircraftTooltip } from '../../context/AircraftTooltipContext';
import { useEnhancedUI } from '../../context/EnhancedUIContext';
import type { ExtendedAircraft } from '@/types/base';
import AircraftPopupContent from './AircraftPopupContent';

interface AircraftPopupComponentProps {
  aircraft: ExtendedAircraft;
}

const AircraftPopupComponent: FC<AircraftPopupComponentProps> = ({
  aircraft,
}) => {
  const { visiblePopups, hidePopup } = useAircraftTooltip();
  const { selectAircraft } = useEnhancedUI();

  // Check if this popup should be visible
  const aircraftId = aircraft.ICAO24 || '';
  const shouldShow = visiblePopups.has(aircraftId);

  // Get the popup aircraft data (with zoom level)
  const popupAircraft = shouldShow
    ? visiblePopups.get(aircraftId) || aircraft
    : null;

  // If no popup should be shown, return null
  if (!shouldShow || !popupAircraft) {
    return null;
  }

  // Handle closing the popup
  const handleClose = () => {
    hidePopup(aircraftId);
  };

  // Handle selecting the aircraft
  const handleSelectAircraft = (icao24: string) => {
    selectAircraft(popupAircraft);
  };

  return (
    <Popup
      className={`aircraft-popup`}
      closeButton={true}
      autoPan={true}
      offset={[0, 0]}
      eventHandlers={{
        remove: handleClose,
      }}
    >
      <AircraftPopupContent
        aircraft={popupAircraft}
        onSelectAircraft={handleSelectAircraft}
        onClose={handleClose}
      />
    </Popup>
  );
};

export default AircraftPopupComponent;
