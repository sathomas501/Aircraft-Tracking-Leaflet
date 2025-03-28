// components/tracking/map/UnifiedAircraftMarker.tsx
import React, { useMemo, useState } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { ExtendedAircraft } from '@/types/base';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import { useEnhancedUI } from '../context/EnhancedUIContext';
import { useDataPersistence } from '../context/DataPersistenceManager';
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
  const isSelected = selectedAircraft?.icao24 === aircraft.icao24;

  // Apply persistence to enhance aircraft data
  const enhancedAircraft = useMemo(() => {
    // Get enhanced data from persistence
    const persistedAircraft = getEnhancedAircraft(aircraft);

    // Ensure required ExtendedAircraft fields are present
    if (!persistedAircraft.type) {
      persistedAircraft.type = persistedAircraft.TYPE_AIRCRAFT || 'unknown';
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
      ? aircraftTrails.get(aircraft.icao24)
      : undefined;

  // Create tooltip content
  const tooltipContent = createTooltipContent(enhancedAircraft, zoomLevel);

  // Should show tooltip based on zoom and selection state
  const shouldShowTooltip = (zoomLevel >= 7 && !isSelected) || isHovering;

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
            direction="top"
            className={`aircraft-tooltip ${isStale ? 'stale-tooltip' : ''}`}
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
