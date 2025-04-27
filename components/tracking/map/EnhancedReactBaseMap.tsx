// components/tracking/map/EnhancedReactBaseMap.tsx
import React from 'react';
import {
  MapContainer,
  TileLayer,
  ZoomControl,
  LayersControl,
} from 'react-leaflet';
import { MAP_CONFIG } from '@/config/map';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import { useEnhancedUI } from '../context/EnhancedUIContext';
import { useFilterLogic } from '../hooks/useFilterLogic'; // Changed from useFilters
import { AircraftTooltipProvider } from '../context/AircraftTooltipContext';
import 'leaflet/dist/leaflet.css';

// Import components
import MapEvents from './components/MapEvents';
import MapControllerInner from '../../MapControllerInner';
import GeofenceCircle from './components/GeofenceCircle';
import MapClickHandler from './components/MapClickHandler';
import SimplifiedAircraftMarker from './SimplifiedAircraftMarker';
import LeafletTouchFix from './components/LeafletTouchFix';
import AircraftSpinner from './components/AircraftSpinner';
import PopupFixer from './components/PopupFixer';
import MapControllerWithOptions from './MapControllerWithOptions';

export interface ReactBaseMapProps {
  onError: (message: string) => void;
}

const EnhancedReactBaseMap: React.FC<ReactBaseMapProps> = ({ onError }) => {
  // components/tracking/map/EnhancedReactBaseMap.tsx (continued)
  const { displayedAircraft } = useEnhancedMapContext();
  const { selectAircraft, isLoading } = useEnhancedUI();
  const { applyFilters } = useFilterLogic(); // Changed from useFilters

  // Apply filters to displayed aircraft
  const filteredAircraft = applyFilters(displayedAircraft);

  // Handle aircraft selection
  const handleMarkerClick = (aircraft: any) => {
    selectAircraft(aircraft);
  };

  return (
    <div className="relative w-full h-full">
      <AircraftSpinner isLoading={isLoading} />

      <MapContainer
        center={MAP_CONFIG.CENTER}
        zoom={MAP_CONFIG.DEFAULT_ZOOM}
        style={{ width: '100%', height: '100%', zIndex: 1 }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapControllerWithOptions />
        <MapControllerInner />
        <MapEvents />
        <ZoomControl position="bottomright" />
        <LeafletTouchFix />
        <LayersControl position="topright" />

        <AircraftTooltipProvider>
          {filteredAircraft.map((aircraft) => (
            <SimplifiedAircraftMarker
              key={aircraft.ICAO24}
              aircraft={aircraft}
              onClick={() => handleMarkerClick(aircraft)}
            />
          ))}
        </AircraftTooltipProvider>

        <MapClickHandler />
        <GeofenceCircle />
        <PopupFixer />
      </MapContainer>
    </div>
  );
};

export default EnhancedReactBaseMap;
