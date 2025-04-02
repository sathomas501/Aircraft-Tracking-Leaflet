// components/tracking/map/UnifiedAircraftMarker.tsx
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { ExtendedAircraft } from '@/types/base';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import { useEnhancedUI } from '../context/EnhancedUIContext';
import { useDataPersistence } from '../persistence/DataPersistenceManager';
import {
  createAircraftIcon,
  createTooltipContent,
} from './AircraftIcon/AircraftIcon';
import AircraftTrail from './components/AircraftTrail';

interface UnifiedAircraftMarkerProps {
  aircraft: ExtendedAircraft;
  isStale?: boolean;
  onMarkerClick?: (aircraft: ExtendedAircraft) => void;
}

// Helper function to apply owner type classes to Leaflet tooltip elements
const applyOwnerTypeStylingToTooltip = (
  tooltipRef: React.RefObject<L.Tooltip>,
  ownerTypeClass: string
) => {
  if (tooltipRef.current) {
    const tooltipElement = tooltipRef.current.getElement();
    if (tooltipElement) {
      // Add the owner type class to the tooltip element
      tooltipElement.classList.add(ownerTypeClass);

      // Force a repaint to ensure styles are applied
      tooltipElement.style.opacity = '0.99';
      setTimeout(() => {
        tooltipElement.style.opacity = '1';
      }, 10);
    }
  }
};

// Use this in your UnifiedAircraftMarker component
const UnifiedAircraftMarker: React.FC<UnifiedAircraftMarkerProps> = ({
  aircraft,
  isStale = false,
}) => {
  const { selectedAircraft, zoomLevel, trailsEnabled, aircraftTrails } =
    useEnhancedMapContext();
  const { selectAircraft } = useEnhancedUI();
  const { getEnhancedAircraft } = useDataPersistence();
  const [isHovering, setIsHovering] = useState(false);

  // Determine if this aircraft is selected
  const isSelected = selectedAircraft?.ICAO24 === aircraft.ICAO24;

  // Apply persistence to enhance aircraft data
  const enhancedAircraft = useMemo(() => {
    // Get enhanced data from persistence
    const persistedAircraft = getEnhancedAircraft(aircraft);

    // Ensure required ExtendedAircraft fields are present
    if (!persistedAircraft.type) {
      persistedAircraft.type = persistedAircraft.AIRCRAFT_TYPE || 'unknown';
    }

    if (persistedAircraft.isGovernment === undefined) {
      persistedAircraft.isGovernment =
        persistedAircraft.OWNER_TYPE === 'GOVERNMENT';
    }

    if (persistedAircraft.isTracked === undefined) {
      persistedAircraft.isTracked = true;
    }

    return persistedAircraft;
  }, [aircraft, getEnhancedAircraft]);

  // Create icon with enhanced data - we can pass isStale to the icon creator
  // only if the AircraftIconOptions interface supports it
  const aircraftIcon = useMemo(() => {
    // If you need to handle stale aircraft appearance, do it in the
    // createAircraftIcon function instead of using className
    return createAircraftIcon(enhancedAircraft, {
      isSelected,
      zoomLevel,
      // only include properties that are defined in AircraftIconOptions
    });
  }, [enhancedAircraft, isSelected, zoomLevel]);

  // Validate position data
  if (!enhancedAircraft.latitude || !enhancedAircraft.longitude) {
    return null;
  }

  // Inside your component, add this function
  const getOwnerTypeClass = (aircraft: any): string => {
    const ownerType = aircraft.OWNER_TYPE || '';

    // Map owner type to CSS class
    const ownerTypeMap: Record<string, string> = {
      '1': 'Individual',
      '2': 'Partnership',
      '3': 'Corp-owner',
      '4': 'Co-owned',
      '7': 'LLC',
      '8': 'non-citizen-corp-owned',
      '9': 'Airline',
      '10': 'Freight',
      '11': 'Medical',
      '12': 'Media',
      '13': 'Historical',
      '14': 'Flying Club',
      '15': 'Emergency',
      '16': 'Local Govt',
      '17': 'Education',
      '18': 'Federal Govt',
      '19': 'Flight School',
      '20': 'Leasing Corp',
    };

    return ownerTypeMap[ownerType] || 'unknown-owner';
  };

  // Create position array safely with validations
  const position: [number, number] = [
    typeof enhancedAircraft.latitude === 'number'
      ? enhancedAircraft.latitude
      : 0,
    typeof enhancedAircraft.longitude === 'number'
      ? enhancedAircraft.longitude
      : 0,
  ];

  // Get trail for this aircraft if enabled
  const trail =
    trailsEnabled && aircraftTrails
      ? aircraftTrails.get(aircraft.ICAO24)
      : undefined;

  // Create tooltip content
  const tooltipContent = createTooltipContent(enhancedAircraft, zoomLevel);

  // Should show tooltip based on zoom and selection state
  const shouldShowTooltip = (zoomLevel >= 7 && !isSelected) || isHovering;

  // Create a ref for the tooltip
  const tooltipRef = useRef<L.Tooltip>(null);

  // Handle marker click - pass enhanced aircraft to selectAircraft
  const handleMarkerClick = () => {
    selectAircraft(enhancedAircraft);
  };

  return (
    <>
      {/* Render trail if available */}
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

      <Marker
        position={position}
        icon={aircraftIcon || undefined}
        zIndexOffset={isSelected ? 1000 : 0}
        eventHandlers={{
          click: handleMarkerClick,
          mouseover: () => setIsHovering(true),
          mouseout: () => setIsHovering(false),
        }}
      >
        {/* Show tooltip based on conditions */}
        {shouldShowTooltip && (
          <Tooltip
            ref={tooltipRef}
            direction="top"
            className={`aircraft-tooltip ${isStale ? 'stale-tooltip' : ''} ${getOwnerTypeClass(enhancedAircraft)}`}
            opacity={0.9}
            offset={[0, -5] as L.PointTuple}
            permanent={isHovering}
          >
            <div
              dangerouslySetInnerHTML={{ __html: tooltipContent as string }}
            />
          </Tooltip>
        )}
      </Marker>
    </>
  );
};

// Use memo to prevent unnecessary re-renders
export default React.memo(UnifiedAircraftMarker);
