import React, { FC, useRef, useEffect } from 'react';
import { Popup, useMap } from 'react-leaflet';
import { useAircraftTooltip } from '../../context/AircraftTooltipContext';
import { useEnhancedUI } from '../../context/EnhancedUIContext';
import type { ExtendedAircraft } from '@/types/base';
import AircraftPopupContent from './AircraftPopupContent';
import L from 'leaflet';

interface AircraftPopupComponentProps {
  aircraft: ExtendedAircraft;
}

const AircraftPopupComponent: FC<AircraftPopupComponentProps> = ({
  aircraft,
}) => {
  const { visiblePopups, hidePopup } = useAircraftTooltip();
  const { selectAircraft } = useEnhancedUI();
  const map = useMap();
  const popupRef = useRef<L.Popup | null>(null);

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

  // Use leaflet's native popup creation instead of react-leaflet's Popup component
  useEffect(() => {
    if (shouldShow && map && aircraft.latitude && aircraft.longitude) {
      // Create popup options
      const popupOptions: L.PopupOptions = {
        className: 'aircraft-popup draggable-popup',
        closeButton: true,
        autoPan: true,
        offset: L.point(0, 0),
        // Custom options aren't typed in PopupOptions but will be passed to L.Popup constructor
        // @ts-ignore
        draggable: true,
      };

      // Create popup content
      const container = document.createElement('div');
      container.className = 'popup-content-container';

      // Initialize popup
      if (!popupRef.current) {
        popupRef.current = L.popup(popupOptions)
          .setLatLng([aircraft.latitude, aircraft.longitude])
          .setContent(container)
          .openOn(map);

        // Render AircraftPopupContent into the container
        const handleClose = () => {
          hidePopup(aircraftId);
        };

        // Create React element
        const popupContent = React.createElement(AircraftPopupContent, {
          aircraft: popupAircraft,
          onSelectAircraft: () => selectAircraft(popupAircraft),
          onClose: handleClose,
        });

        // Render to the container
        import('react-dom').then((ReactDOM) => {
          ReactDOM.render(popupContent, container);
        });

        // Add event listeners
        popupRef.current.on('remove', () => {
          hidePopup(aircraftId);
        });
      }
    }

    // Cleanup
    return () => {
      if (popupRef.current) {
        import('react-dom').then((ReactDOM) => {
          const container = popupRef.current?.getContent();
          if (container && ReactDOM.unmountComponentAtNode) {
            ReactDOM.unmountComponentAtNode(container as HTMLElement);
          }
        });

        popupRef.current.remove();
        popupRef.current = null;
      }
    };
  }, [shouldShow, map, aircraft.latitude, aircraft.longitude]);

  // We're not returning the Popup component anymore
  // because we're using the native Leaflet API
  return null;
};

export default AircraftPopupComponent;
