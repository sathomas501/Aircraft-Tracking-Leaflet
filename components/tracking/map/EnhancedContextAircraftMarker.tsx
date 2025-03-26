// EnhancedContextAircraftMarker.tsx
import React, { useRef, useState, useEffect, memo, useMemo } from 'react';
import { Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import {
  createAircraftIcon,
  createTooltipContent,
  createPopupContent,
} from './AircraftIcon/AircraftIcon';
import type { ExtendedAircraft } from '@/types/base';
import type { CachedAircraftData } from '@/types/base';
import L from 'leaflet';
import AircraftTrail from './components/AircraftTrail';

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
    trailsEnabled,
    aircraftTrails,
    cachedAircraftData, // Get cached data from context
  } = useEnhancedMapContext();

  const isSelected = selectedAircraft?.icao24 === aircraft.icao24;
  const markerRef = useRef<L.Marker>(null);
  const [isHovering, setIsHovering] = useState(false);

  // Skip rendering if no valid position
  if (!aircraft?.latitude || !aircraft?.longitude) return null;

  // Enhanced aircraft with cached data
  const enhancedAircraft = useMemo(() => {
    // If we have cached data for this aircraft, enhance it with static fields
    if (
      aircraft.icao24 &&
      cachedAircraftData &&
      cachedAircraftData[aircraft.icao24]
    ) {
      const cached = cachedAircraftData[aircraft.icao24];
      return {
        ...aircraft, // Start with current data (position, etc.)
        // Preserve specific fields from cache if they're missing in current data
        manufacturer: aircraft.manufacturer || cached.manufacturer,
        model: aircraft.model || cached.model,
        'N-NUMBER': aircraft['N-NUMBER'] || cached['N-NUMBER'],
        TYPE_AIRCRAFT: aircraft.TYPE_AIRCRAFT || cached.TYPE_AIRCRAFT,
        CITY: aircraft.CITY || cached.CITY,
        STATE: aircraft.STATE || cached.STATE,
        OWNER_TYPE: aircraft.OWNER_TYPE || cached.OWNER_TYPE,
        NAME: aircraft.NAME || cached.NAME,
      } as ExtendedAircraft;
    }

    // No cached data available, use aircraft as is
    return aircraft;
  }, [aircraft, cachedAircraftData, zoomLevel]);

  // Get the trail for this aircraft
  const trail =
    trailsEnabled && aircraftTrails
      ? aircraftTrails.get(aircraft.icao24) ||
        aircraftTrails.get(aircraft.icao24?.toLowerCase())
      : undefined;

  // Create tooltip content using the utility function with enhanced data
  const tooltipContent = createTooltipContent(enhancedAircraft, zoomLevel || 9);

  // Create popup content using the utility function with enhanced data
  const popupContent = createPopupContent(enhancedAircraft, zoomLevel || 9);

  // Get aircraft icon
  const icon = useMemo(() => {
    return createAircraftIcon(enhancedAircraft, {
      isSelected,
      zoomLevel: zoomLevel || 9,
    });
  }, [enhancedAircraft, isSelected, zoomLevel]); // Explicit dependency on zoomLevel

  return (
    <>
      {/* Render trail if enabled and available */}
      {trailsEnabled && trail && trail.length >= 2 && (
        <AircraftTrail
          positions={trail}
          color={isSelected ? '#3388ff' : '#3388ff80'}
          weight={isSelected ? 3 : 2}
          opacity={isSelected ? 0.9 : 0.65}
          zIndexOffset={isSelected ? 900 : 0}
          fadeEffect={true}
          selected={isSelected}
        />
      )}

      {/* Single marker approach - no more duplicates */}
      <Marker
        ref={markerRef}
        position={[aircraft.latitude, aircraft.longitude]}
        icon={icon || undefined}
        zIndexOffset={isSelected ? 1000 : 0}
        eventHandlers={{
          click: () => {
            console.log('Marker clicked:', aircraft.icao24);
            // Pass the enhanced aircraft to selectAircraft
            selectAircraft(enhancedAircraft);
          },
          mouseover: () => {
            console.log('Marker hover start:', aircraft.icao24);
            setIsHovering(true);
          },
          mouseout: () => {
            console.log('Marker hover end:', aircraft.icao24);
            setIsHovering(false);
          },
        }}
      >
        {/* Only show tooltip when hovering */}
        {isHovering && (
          <Tooltip
            direction="top"
            offset={[0, -20]}
            permanent={true}
            className="aircraft-tooltip visible"
          >
            <div dangerouslySetInnerHTML={{ __html: tooltipContent }} />
          </Tooltip>
        )}
      </Marker>
    </>
  );
};

export default memo(EnhancedContextAircraftMarker);
