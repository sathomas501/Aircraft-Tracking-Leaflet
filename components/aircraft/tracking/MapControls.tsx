//components/Maps/MapControls.tsx
import React, { useCallback } from 'react';
import { useMap } from 'react-leaflet';
import { Map as LeafletMap, LatLngExpression } from 'leaflet';
import { MAP } from '@//utils/mapConstants';

interface MapControlsProps {
  onFitBounds?: () => void;
  selectedAircraftPosition?: LatLngExpression;
}

const MapControls: React.FC<MapControlsProps> = ({ 
  onFitBounds, 
  selectedAircraftPosition 
}) => {
  const leafletMap = useMap();

  const handleResetView = useCallback(() => {
    leafletMap.setView(MAP.DEFAULT_CENTER, MAP.DEFAULT_ZOOM);
  }, [leafletMap]);

  const handleFocusSelected = useCallback(() => {
    if (selectedAircraftPosition) {
      leafletMap.setView(selectedAircraftPosition, 10);
    } else if (onFitBounds) {
      onFitBounds();
    }
  }, [leafletMap, selectedAircraftPosition, onFitBounds]);

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
            className="p-2 bg-white hover:bg-gray-100 border-b border-gray-300"
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

export default MapControls;