// EnhancedContextAircraftMarker.tsx
import React, { useRef, useState, memo, useMemo } from 'react';
import { Marker, useMap } from 'react-leaflet';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import {
  createAircraftIcon,
  getOwnerTypeClass,
} from './AircraftIcon/AircraftIcon';
import type { ExtendedAircraft } from '@/types/base';
import L from 'leaflet';
import { useAircraftTooltip } from '../context/AircraftTooltipContext';
import AircraftTooltipComponent from './components/AircraftTooltipComponent';
import AircraftPopupComponent from './components/AircraftPopupComponent';

// Define the props interface
interface EnhancedContextAircraftMarkerProps {
  aircraft: ExtendedAircraft;
}

// Define the component with proper React FC syntax
const EnhancedContextAircraftMarker: React.FC<
  EnhancedContextAircraftMarkerProps
> = ({ aircraft }) => {
  const map = useMap();
  const {
    selectedAircraft,
    selectAircraft,
    zoomLevel,
    cachedAircraftData, // Get cached data from context
  } = useEnhancedMapContext();

  const { showTooltip, hideTooltip, showPopup, setIsPermanentTooltip } =
    useAircraftTooltip();

  const isSelected = selectedAircraft?.ICAO24 === aircraft.ICAO24;
  const markerRef = useRef<L.Marker>(null);
  const [isHovering, setIsHovering] = useState(false);

  // Skip rendering if no valid position
  if (!aircraft?.latitude || !aircraft?.longitude) return null;

  // Enhanced aircraft with cached data
  const enhancedAircraft = useMemo(() => {
    // If we have cached data for this aircraft, enhance it with static fields
    if (
      aircraft.ICAO24 &&
      cachedAircraftData &&
      cachedAircraftData[aircraft.ICAO24]
    ) {
      const cached = cachedAircraftData[aircraft.ICAO24];
      return {
        ...aircraft, // Start with current data (position, etc.)
        // Preserve specific fields from cache if they're missing in current data
        MANUFACTURER: aircraft.MANUFACTURER || cached.MANUFACTURER,
        MODEL: aircraft.MODEL || cached.MODEL,
        REGISTRATION: aircraft['REGISTRATION'] || cached['REGISTRATION'],
        TYPE_AIRCRAFT: aircraft.TYPE_AIRCRAFT || cached.TYPE_AIRCRAFT,
        CITY: aircraft.CITY || cached.CITY,
        STATE: aircraft.STATE || cached.STATE,
        TYPE_REGISTRANT: aircraft.TYPE_REGISTRANT || cached.TYPE_REGISTRANT,
        NAME: aircraft.NAME || cached.NAME,
      } as ExtendedAircraft;
    }

    // No cached data available, use aircraft as is
    return aircraft;
  }, [aircraft, cachedAircraftData, zoomLevel]);

  // Get owner type class for the aircraft
  const ownerClass = getOwnerTypeClass(enhancedAircraft);

  // Get aircraft icon
  const icon = useMemo(() => {
    return createAircraftIcon(enhancedAircraft, {
      isSelected,
      zoomLevel: zoomLevel || 9,
    });
  }, [enhancedAircraft, isSelected, zoomLevel]); // Explicit dependency on zoomLevel

  // Event handlers
  const handleMarkerClick = () => {
    console.log('Marker clicked:', aircraft.ICAO24);
    // Pass the enhanced aircraft to selectAircraft
    selectAircraft(enhancedAircraft);

    // Show popup for this aircraft
    showPopup({
      ...enhancedAircraft,
      zoomLevel: zoomLevel || 9,
    });
  };

  const handleMouseOver = () => {
    console.log('Marker hover start:', aircraft.ICAO24);
    setIsHovering(true);

    // Add zoom level to aircraft for tooltip rendering
    const aircraftWithZoom = {
      ...enhancedAircraft,
      zoomLevel: zoomLevel || 9,
    };

    // Show tooltip and make it permanent
    showTooltip(aircraftWithZoom);
    setIsPermanentTooltip(true);
  };

  const handleMouseOut = () => {
    console.log('Marker hover end:', aircraft.ICAO24);
    setIsHovering(false);

    // Hide tooltip
    hideTooltip(aircraft.ICAO24);
    setIsPermanentTooltip(false);
  };

  return (
    <>
      {/* Single marker approach - no more duplicates */}
      <Marker
        ref={markerRef}
        position={[aircraft.latitude, aircraft.longitude]}
        icon={icon || undefined}
        zIndexOffset={isSelected ? 1000 : 0}
        eventHandlers={{
          click: handleMarkerClick,
          mouseover: handleMouseOver,
          mouseout: handleMouseOut,
        }}
      >
        {/* Tooltip and Popup components */}
        <AircraftTooltipComponent aircraft={enhancedAircraft} />
        <AircraftPopupComponent aircraft={enhancedAircraft} />
      </Marker>
    </>
  );
};

export default memo(EnhancedContextAircraftMarker);
