// EnhancedContextAircraftMarker.tsx
import React, { useRef, useState, useEffect, memo, useMemo } from 'react';
import { Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import {
  createAircraftIcon,
  createTooltipContent,
  createPopupContent,
  getOwnerTypeClass,
} from './AircraftIcon/AircraftIcon';
import type { ExtendedAircraft } from '@/types/base';
import L from 'leaflet';
import AircraftTrail from './components/AircraftTrail';

// Define the props interface
interface EnhancedContextAircraftMarkerProps {
  aircraft: ExtendedAircraft;
}

// Helper function to apply owner type classes to Leaflet tooltip elements
const applyOwnerTypeStylingToTooltip = (
  tooltipRef: React.RefObject<L.Tooltip>,
  ownerTypeClass: string
) => {
  if (tooltipRef.current) {
    const tooltipElement = tooltipRef.current.getElement();
    if (tooltipElement) {
      // Remove any previous owner type classes
      tooltipElement.classList.forEach((cls) => {
        if (cls.startsWith('owner-') || cls.endsWith('-owner')) {
          tooltipElement.classList.remove(cls);
        }
      });

      // Add the owner type class to the tooltip element
      tooltipElement.classList.add(`owner-${ownerTypeClass}`);
      tooltipElement.classList.add(`${ownerTypeClass}-owner`);

      // Force a repaint to ensure styles are applied
      tooltipElement.style.opacity = '0.99';
      setTimeout(() => {
        tooltipElement.style.opacity = '1';
      }, 10);
    }
  }
};

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

  const isSelected = selectedAircraft?.ICAO24 === aircraft.ICAO24;
  const markerRef = useRef<L.Marker>(null);
  const tooltipRef = useRef<L.Tooltip>(null);
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
        N_NUMBER: aircraft['N_NUMBER'] || cached['N_NUMBER'],
        AIRCRAFT_TYPE: aircraft.AIRCRAFT_TYPE || cached.AIRCRAFT_TYPE,
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
      ? aircraftTrails.get(aircraft.ICAO24) ||
        aircraftTrails.get(aircraft.ICAO24?.toLowerCase())
      : undefined;

  // Get owner type class for the aircraft
  const ownerClass = getOwnerTypeClass(enhancedAircraft);

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

  // Apply owner type styling to tooltip after render
  useEffect(() => {
    if (isHovering && tooltipRef.current) {
      applyOwnerTypeStylingToTooltip(tooltipRef, ownerClass);
    }
  }, [isHovering, tooltipRef.current, ownerClass]);

  return (
    <>
      {/* Render trail if enabled and available */}
      {trailsEnabled && trail && trail.length >= 2 && (
        <AircraftTrail
          positions={trail.map((pos) => ({
            lat: typeof pos.latitude === 'number' ? pos.latitude : 0,
            lng: typeof pos.longitude === 'number' ? pos.longitude : 0,
            altitude: pos.altitude,
            timestamp: pos.timestamp || Date.now(),
          }))}
          color={isSelected ? '#3388ff' : '#3388ff80'}
          weight={isSelected ? 3 : 2}
          opacity={isSelected ? 0.9 : 0.65}
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
            console.log('Marker clicked:', aircraft.ICAO24);
            // Pass the enhanced aircraft to selectAircraft
            selectAircraft(enhancedAircraft);
          },
          mouseover: () => {
            console.log('Marker hover start:', aircraft.ICAO24);
            setIsHovering(true);
          },
          mouseout: () => {
            console.log('Marker hover end:', aircraft.ICAO24);
            setIsHovering(false);
          },
        }}
      >
        {/* Only show tooltip when hovering */}
        {isHovering && (
          <Tooltip
            ref={tooltipRef}
            direction="top"
            offset={[0, -20]}
            permanent={true}
            className={`aircraft-tooltip visible owner-${ownerClass} ${ownerClass}-owner`}
          >
            <div dangerouslySetInnerHTML={{ __html: tooltipContent }} />
          </Tooltip>
        )}
      </Marker>
    </>
  );
};

export default memo(EnhancedContextAircraftMarker);
