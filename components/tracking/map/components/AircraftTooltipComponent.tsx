// components/tracking/map/components/AircraftTooltipComponent.tsx
import React, { FC } from 'react';
import { Tooltip } from 'react-leaflet';
import {
  getOwnerTypeClass,
  createTooltipContent,
} from '../AircraftIcon/AircraftIcon';
import { useAircraftTooltip } from '../../context/AircraftTooltipContext';

/**
 * Centralized Aircraft Tooltip Component
 * This component is responsible for rendering tooltips for aircraft markers
 * It uses the AircraftTooltipContext to determine when to show tooltips
 */
const AircraftTooltipComponent: FC = () => {
  const {
    isTooltipVisible,
    tooltipAircraft,
    tooltipOffset,
    isPermanentTooltip,
  } = useAircraftTooltip();

  // If no tooltip should be shown, return null
  if (!isTooltipVisible || !tooltipAircraft) {
    return null;
  }

  // Get owner type class for styling
  const ownerTypeClass = getOwnerTypeClass(tooltipAircraft);

  // Get zoom level from context or default to 9
  const zoomLevel = tooltipAircraft.zoomLevel || 9;

  // Generate tooltip content
  const tooltipContent = createTooltipContent(tooltipAircraft, zoomLevel);

  return (
    <Tooltip
      direction="top"
      offset={tooltipOffset}
      permanent={isPermanentTooltip}
      className="aircraft-tooltip visible"
    >
      <div
        dangerouslySetInnerHTML={{ __html: tooltipContent }}
        className={`aircraft-tooltip-wrapper ${ownerTypeClass}`}
      />
    </Tooltip>
  );
};

export default AircraftTooltipComponent;
