// components/tracking/map/components/AircraftTrail.tsx
import React, { useMemo } from 'react';
import { Polyline } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';

// Define the AircraftTrail props interface
interface AircraftTrailProps {
  positions: Array<{
    lat: number;
    lng: number;
    timestamp?: number;
    altitude?: number | null;
  }>;
  color?: string;
  weight?: number;
  opacity?: number;
  zIndexOffset?: number;
  fadeEffect?: boolean;
  selected?: boolean;
}

const AircraftTrail: React.FC<AircraftTrailProps> = ({
  positions,
  color = '#3388ff',
  weight = 2,
  opacity = 0.7,
  zIndexOffset = 0,
  fadeEffect = true,
  selected = false,
}) => {
  // Convert positions to the format expected by Leaflet
  const trailPositions: LatLngExpression[] = useMemo(() => {
    return positions.map((pos) => [pos.lat, pos.lng]);
  }, [positions]);

  // Create fade gradient effect if enabled
  const colorOptions = useMemo(() => {
    if (!fadeEffect || positions.length < 2) {
      return { color, weight, opacity };
    }

    // Create an array of colors with decreasing opacity for fade effect
    const colors: Record<string, any>[] = [];
    const segments = positions.length - 1;

    for (let i = 0; i < segments; i++) {
      const segmentOpacity = selected
        ? opacity * (0.3 + (0.7 * i) / segments) // Selected trails are more visible
        : opacity * (0.1 + (0.9 * i) / segments); // Normal fade

      colors.push({
        color,
        weight,
        opacity: segmentOpacity,
      });
    }

    return colors;
  }, [positions, color, weight, opacity, fadeEffect, selected]);

  // If no positions or not enough for a line, don't render
  if (!positions || positions.length < 2) {
    return null;
  }

  // If fade effect is enabled and we have gradient colors
  if (fadeEffect && Array.isArray(colorOptions)) {
    // For fade effect, we render multiple line segments with decreasing opacity
    return (
      <>
        {positions.slice(0, -1).map((_, index) => (
          <Polyline
            key={`segment-${index}`}
            positions={[trailPositions[index], trailPositions[index + 1]]}
            pathOptions={colorOptions[index]}
          />
        ))}
      </>
    );
  }

  // For simple trail with no fade, render a single polyline
  return (
    <Polyline positions={trailPositions} pathOptions={colorOptions as any} />
  );
};

export default React.memo(AircraftTrail);
