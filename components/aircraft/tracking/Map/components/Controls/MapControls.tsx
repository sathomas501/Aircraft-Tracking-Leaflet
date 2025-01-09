// components/aircraft/tracking/Map/components/Controls/MapControls.tsx
import React, { useCallback } from 'react';
import { useMap } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import { CONTINENTAL_US_BOUNDS } from './../../../../../../constants/map';

interface MapControlsProps {
  onFitBounds?: () => void;
  selectedAircraftPosition?: LatLngExpression;
}

export const MapControls: React.FC<MapControlsProps> = ({ 
  onFitBounds, 
  selectedAircraftPosition 
}) => {
  const map = useMap();

  const handleResetView = useCallback(() => {
    map.fitBounds(CONTINENTAL_US_BOUNDS, { padding: [20, 20] });
  }, [map]);

  const handleFocusSelected = useCallback(() => {
    if (selectedAircraftPosition) {
      map.setView(selectedAircraftPosition, 10);
    } else if (onFitBounds) {
      onFitBounds();
    }
  }, [map, selectedAircraftPosition, onFitBounds]);

  return (
    <div className="leaflet-top leaflet-left">
      <div className="leaflet-control leaflet-bar">
        <button
          onClick={handleResetView}
          className="p-2 bg-white hover:bg-gray-100 border-b border-gray-300"
          title="Reset view"
          type="button"
        >
          🏠
        </button>
        {(selectedAircraftPosition || onFitBounds) && (
          <button
            onClick={handleFocusSelected}
            className="p-2 bg-white hover:bg-gray-100"
            title={selectedAircraftPosition ? "Focus selected aircraft" : "Fit all aircraft"}
            type="button"
          >
            🎯
          </button>
        )}
      </div>
    </div>
  );
};