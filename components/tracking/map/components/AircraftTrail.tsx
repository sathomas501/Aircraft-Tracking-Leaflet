// components/tracking/map/components/AircraftTrail.tsx
import React, { useMemo } from 'react';
import { Polyline } from 'react-leaflet';
import L from 'leaflet';

interface AircraftPosition {
  latitude: number;
  longitude: number;
  altitude: number | null;
  timestamp: number;
}

interface AircraftTrailProps {
  positions: AircraftPosition[];
  color?: string;
  weight?: number;
  opacity?: number;
  zIndexOffset?: number;
  fadeEffect?: boolean; // Whether to apply a fade effect to older positions
  dashArray?: string; // Optional dash pattern for the line
  selected?: boolean; // Whether this aircraft is selected
}

interface SegmentOptions {
  positions: L.LatLngTuple[];
  options: L.PathOptions;
}

const AircraftTrail: React.FC<AircraftTrailProps> = ({
  positions,
  color = '#3388ff',
  weight = 2,
  opacity = 0.8,
  zIndexOffset = 0,
  fadeEffect = true,
  dashArray = '',
  selected = false,
}) => {
  // Skip rendering if there are not enough positions for a trail
  if (!positions || positions.length < 2) return null;

  // Convert positions to LatLngTuples for Leaflet
  const latLngs = useMemo(() => {
    return positions.map(
      (pos) => [pos.latitude, pos.longitude] as L.LatLngTuple
    );
  }, [positions]);

  // For fade effect, create multiple polylines with decreasing opacity
  if (fadeEffect) {
    // Calculate segments with decreasing opacity
    const segments = useMemo<SegmentOptions[]>(() => {
      const result: SegmentOptions[] = [];
      const totalSegments = Math.min(positions.length - 1, 5); // Max 5 segments

      for (let i = 0; i < totalSegments; i++) {
        const segmentSize = Math.ceil((positions.length - 1) / totalSegments);
        const startIdx = i * segmentSize;
        const endIdx = Math.min(startIdx + segmentSize + 1, positions.length);

        // Calculate opacity based on segment position (older segments are more transparent)
        const segmentOpacity = opacity * (0.5 + 0.5 * (i / totalSegments));

        // Create a valid PathOptions object
        const pathOptions: L.PathOptions = {
          color,
          weight: selected ? weight + 1 : weight,
          opacity: segmentOpacity,
          dashArray,
        };

        // The pane property can be used to control layering
        // 'overlayPane' is the default pane for polylines
        // You can add custom panes with different z-indexes via the map object if needed

        result.push({
          positions: latLngs.slice(startIdx, endIdx),
          options: pathOptions,
        });
      }

      return result;
    }, [positions, color, weight, opacity, dashArray, selected, latLngs]);

    // Render multiple polylines with decreasing opacity
    return (
      <>
        {segments.map((segment, index) => (
          <Polyline
            key={`segment-${index}`}
            positions={segment.positions}
            pathOptions={segment.options}
            // Optional: Use bubblingMouseEvents={false} to prevent events from passing through
            bubblingMouseEvents={false}
          />
        ))}
      </>
    );
  }

  // Simple single polyline without fade effect
  const pathOptions: L.PathOptions = {
    color,
    weight: selected ? weight + 1 : weight,
    opacity,
    dashArray,
  };

  return (
    <Polyline
      positions={latLngs}
      pathOptions={pathOptions}
      bubblingMouseEvents={false}
    />
  );
};

export default React.memo(AircraftTrail);
