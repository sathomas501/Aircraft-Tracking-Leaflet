// components/tracking/map/components/AircraftTooltipComponent.tsx
import React, { FC } from 'react';
import { Tooltip } from 'react-leaflet';
import { useAircraftTooltip } from '../../context/AircraftTooltipContext';
import type { ExtendedAircraft } from '@/types/base';
import AircraftTooltipContent from './AircraftTooltipContent';

interface AircraftTooltipComponentProps {
  aircraft: ExtendedAircraft;
  isStale?: boolean;
}

/**
 * Centralized Aircraft Tooltip Component
 * This component is responsible for rendering tooltips for aircraft markers
 * It uses the AircraftTooltipContext to determine when to show tooltips
 */
const AircraftTooltipComponent: FC<AircraftTooltipComponentProps> = ({
  aircraft,
  isStale = false,
}) => {
  const { visibleTooltips, tooltipOffset, isPermanentTooltip } =
    useAircraftTooltip();

  // Check if this tooltip should be visible
  const aircraftId = aircraft.ICAO24 || '';
  const shouldShow = visibleTooltips.has(aircraftId);

  // Get the tooltip aircraft data (with zoom level)
  const tooltipAircraft = shouldShow
    ? visibleTooltips.get(aircraftId) || aircraft
    : null;

  // If no tooltip should be shown, return null
  if (!shouldShow || !tooltipAircraft) {
    return null;
  }

  // Get zoom level from data or default to 9
  const zoomLevel = tooltipAircraft.zoomLevel || 9;

  return (
    <Tooltip
      direction="top"
      offset={tooltipOffset}
      permanent={isPermanentTooltip}
      className={`aircraft-tooltip visible ${isStale ? 'stale-tooltip' : ''}`}
    >
      <AircraftTooltipContent
        aircraft={tooltipAircraft}
        zoomLevel={zoomLevel}
      />
    </Tooltip>
  );
};

export default AircraftTooltipComponent;
