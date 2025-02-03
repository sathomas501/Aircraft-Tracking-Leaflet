// components/aircraft/tracking/Map/components/MapControls.tsx
import React from 'react';
import { useMap } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';

interface MapControlsProps {
  onFitBounds?: () => void;
  selectedAircraftPosition?: LatLngExpression;
  className?: string;
  defaultCenter?: LatLngExpression;
  defaultZoom?: number;
}

export const MapControls: React.FC<MapControlsProps> = ({ 
  onFitBounds, 
  selectedAircraftPosition,
  className = "",
  defaultCenter = [51.505, -0.09],  // ✅ Default center
  defaultZoom = 1                  // ✅ Default zoom
}) => {
  const map = useMap();

  const handleResetView = () => {
    console.log('[MapControl] Reset View Triggered');
    map.setView(defaultCenter, defaultZoom);
  };
  
  const handleFocusSelected = () => {
    console.log('[MapControl] Focus Selected Triggered');
    if (selectedAircraftPosition) {
      map.flyTo(selectedAircraftPosition, 10, { animate: true });
    } else if (onFitBounds) {
      onFitBounds();
    }
  };  

  return (
    <div className={`absolute top-4 left-4 z-[1000] ${className}`}>
      <div className="flex flex-col gap-2 bg-white rounded-lg shadow-lg p-2">
        <button
          onClick={handleResetView}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Reset view"
          type="button"
        >
          🏠
        </button>
        {(selectedAircraftPosition || onFitBounds) && (
          <button
            onClick={handleFocusSelected}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
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
