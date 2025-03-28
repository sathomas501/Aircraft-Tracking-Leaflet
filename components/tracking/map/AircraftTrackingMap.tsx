// components/tracking/map/AircraftTrackingMap.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ExtendedAircraft, SelectOption } from '@/types/base';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import { useEnhancedUI } from '../context/EnhancedUIContext';
import { useDataPersistence } from '../context/DataPersistenceManager';
import UnifiedAircraftMarker from './UnifiedAircraftMarker';
import DataPersistenceDebug from './DataPersistenceDebug';

// Map position updater component
const MapUpdater: React.FC = () => {
  const map = useMap();
  const { setMapInstance, setZoomLevel } = useEnhancedMapContext();
  const { saveMapPosition } = useDataPersistence();

  // Update map instance in context when map is ready
  useEffect(() => {
    if (map) {
      setMapInstance(map);
      setZoomLevel(map.getZoom());

      // Listen for map moves to save position
      const handleMoveEnd = () => {
        const center = map.getCenter();
        const zoom = map.getZoom();
        saveMapPosition([center.lat, center.lng], zoom);
        setZoomLevel(zoom);
      };

      map.on('moveend', handleMoveEnd);
      map.on('zoomend', () => setZoomLevel(map.getZoom()));

      return () => {
        map.off('moveend', handleMoveEnd);
        map.off('zoomend');
      };
    }
  }, [map, setMapInstance, setZoomLevel, saveMapPosition]);

  return null;
};

// Restore map state component
const RestoreMapState: React.FC = () => {
  const map = useMap();
  const { getInitialMapState } = useDataPersistence();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (map && !initialized) {
      const mapState = getInitialMapState();
      if (mapState) {
        const { center, zoom } = mapState;
        map.setView(center, zoom);
        console.log('[AircraftMap] Restored map state:', { center, zoom });
      }
      setInitialized(true);
    }
  }, [map, getInitialMapState, initialized]);

  return null;
};

// Restore selected aircraft component
const RestoreSelectedAircraft: React.FC = () => {
  const { cachedAircraft, getSelectedAircraftId } = useDataPersistence();
  const { displayedAircraft } = useEnhancedMapContext();
  const { selectAircraft } = useEnhancedUI();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && displayedAircraft.length > 0) {
      const selectedIcao = getSelectedAircraftId();

      if (selectedIcao) {
        // Try to find in displayed aircraft first
        const aircraft = displayedAircraft.find(
          (a) => a.icao24 === selectedIcao
        );

        if (aircraft) {
          selectAircraft(aircraft);
        } else if (cachedAircraft[selectedIcao]) {
          // If not in displayed, try to use cached data
          selectAircraft({
            ...cachedAircraft[selectedIcao],
            // Add required ExtendedAircraft properties
            isStale: true,
            type: cachedAircraft[selectedIcao].TYPE_AIRCRAFT || 'unknown',
            isGovernment:
              cachedAircraft[selectedIcao].OWNER_TYPE === 'GOVERNMENT' || false,
            isTracked: true,
          } as ExtendedAircraft);
        }
      }

      setInitialized(true);
    }
  }, [
    displayedAircraft,
    getSelectedAircraftId,
    selectAircraft,
    cachedAircraft,
    initialized,
  ]);

  return null;
};

// Main map component
interface AircraftTrackingMapProps {
  aircraft: ExtendedAircraft[];
  showDebug?: boolean;
  initialCenter?: [number, number];
  initialZoom?: number;
  manufacturers?: SelectOption[];
  onError?: (message: string) => void;
}

const AircraftTrackingMap: React.FC<AircraftTrackingMapProps> = ({
  aircraft,
  showDebug = process.env.NODE_ENV === 'development',
  initialCenter = [39.8283, -98.5795], // US center
  initialZoom = 5,
  manufacturers = [], // New prop with default
  onError = () => {}, // New prop with default
}) => {
  const { zoomLevel, trailsEnabled, selectedAircraft } =
    useEnhancedMapContext();
  const { updateAircraftCache } = useDataPersistence();
  const [mapKey, setMapKey] = useState<string>(`map-${Date.now()}`);

  // Update aircraft cache when aircraft data changes
  useEffect(() => {
    if (aircraft && aircraft.length > 0) {
      updateAircraftCache(aircraft);
    }
  }, [aircraft, updateAircraftCache]);

  // Handle window focus/blur to improve persistence
  useEffect(() => {
    const handleFocus = () => {
      console.log('[AircraftMap] Window focused, refreshing map');
      // Force reload the map component on window focus
      setMapKey(`map-${Date.now()}`);
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Combine stale markers from cache with current markers
  const getEnhancedAircraftList = useCallback(() => {
    if (!aircraft || aircraft.length === 0) return [];

    // Keep track of which ICAO24s we've seen in the current data
    const currentIcaos = new Set<string>();

    // Start with current aircraft
    const enhancedList = [...aircraft];

    // Mark all current aircraft as seen
    aircraft.forEach((ac) => {
      if (ac.icao24) {
        currentIcaos.add(ac.icao24);
      }
    });

    // Add stale markers from cache?
    // For now, let's skip this to keep clean tracking data
    // But this could be a feature toggle to show "stale" aircraft

    return enhancedList;
  }, [aircraft]);

  return (
    <div className="relative w-full h-full">
      <MapContainer
        key={mapKey}
        center={initialCenter}
        zoom={initialZoom}
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
        preferCanvas={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <ZoomControl position="bottomright" />

        {/* Map setup components */}
        <MapUpdater />
        <RestoreMapState />
        <RestoreSelectedAircraft />

        {/* Aircraft markers */}
        {getEnhancedAircraftList().map((ac) => (
          <UnifiedAircraftMarker
            key={`${ac.icao24}-${ac.lastSeen || Date.now()}`}
            aircraft={ac}
            isStale={false}
          />
        ))}
      </MapContainer>

      {/* Debug panel */}
      {showDebug && <DataPersistenceDebug />}
    </div>
  );
};

export default AircraftTrackingMap;
