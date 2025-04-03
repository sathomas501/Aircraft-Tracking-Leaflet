// components/tracking/map/components/AircraftPopupComponent.tsx
import React, { FC } from 'react';
import { Popup } from 'react-leaflet';
import {
  getOwnerTypeClass,
  createPopupContent,
} from '../AircraftIcon/AircraftIcon';
import { useAircraftTooltip } from '../../context/AircraftTooltipContext';

/**
 * Centralized Aircraft Popup Component
 * This component is responsible for rendering popups for aircraft markers
 * It uses the AircraftTooltipContext to determine when to show popups
 */
const AircraftPopupComponent: FC = () => {
  const { isPopupVisible, popupAircraft, hidePopup } = useAircraftTooltip();

  // If no popup should be shown, return null
  if (!isPopupVisible || !popupAircraft) {
    return null;
  }

  // Get owner type class for styling
  const ownerTypeClass = getOwnerTypeClass(popupAircraft);

  // Get zoom level from context or default to 9
  const zoomLevel = popupAircraft.zoomLevel || 9;

  // Generate popup content
  const popupContent = createPopupContent(popupAircraft, zoomLevel);

  return (
    <Popup
      className={`aircraft-popup ${ownerTypeClass}`}
      closeButton={true}
      autoPan={true}
      eventHandlers={{
        remove: hidePopup,
      }}
    >
      <div
        dangerouslySetInnerHTML={{ __html: popupContent }}
        className={`aircraft-popup-content ${ownerTypeClass}`}
      />
    </Popup>
  );
};

export default AircraftPopupComponent;
