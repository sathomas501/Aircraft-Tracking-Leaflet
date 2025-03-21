// components/tracking/map/OptimizedReactBaseMap.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  useMap,
  LayersControl,
  ZoomControl,
} from 'react-leaflet';
import { useMapContext } from '../context/MapContext';
import { MAP_CONFIG } from '@/config/map';
import type { ExtendedAircraft } from '@/types/base';
import ContextAircraftMarker from './components/ContextAircraftMarker';
import ContextMapControls from './components/ContextMapControls';
import ContextAircraftInfoPanel from './components/ContextAircraftInfoPanel';
import { processAircraftInChunks } from '../utils/performanceUtils';

// Inner component to connect the map instance to context
const MapControllerInner: React.FC = () => {
  const { setMapInstance, setZoomLevel } = useMapContext();
  const map = useMap();

  useEffect(() => {
    console.log('[OptimizedReactBaseMap] Registering map with context');
    setMapInstance(map);

    const handleZoom = () => {
      setZoomLevel(map.getZoom());
    };

    map.on('zoomend', handleZoom);
    setZoomLevel(map.getZoom());

    return () => {
      console.log('[OptimizedReactBaseMap] Cleaning up map registration');
      map.off('zoomend', handleZoom);
      setMapInstance(null);
    };
  }, [map, setMapInstance, setZoomLevel]);

  return null;
};

// Props interface
export interface ReactBaseMapProps {
  aircraft: ExtendedAircraft[];
  onError: (message: string) => void;
}

const OptimizedReactBaseMap: React.FC<ReactBaseMapProps> = ({
  aircraft,
  onError,
}) => {
  const { preserveView, isRefreshing } = useMapContext();
  // State to hold optimized aircraft data for rendering
  const [processedAircraft, setProcessedAircraft] = useState<
    ExtendedAircraft[]
  >([]);
  // State to track processing status
  const [isProcessing, setIsProcessing] = useState(false);
  // Track the number of aircraft rendered so far
  const [renderedCount, setRenderedCount] = useState(0);
  // Reference to store previous aircraft data for comparison
  const prevAircraftRef = useRef<ExtendedAircraft[]>([]);

  // Process aircraft data in chunks to prevent UI lockups
  useEffect(() => {
    const filterAndProcess = async () => {
      // Only start processing if not already processing
      if (isProcessing) return;

      // Filter aircraft with valid coordinates
      const validAircraft = aircraft.filter(
        (plane) =>
          typeof plane.latitude === 'number' &&
          typeof plane.longitude === 'number' &&
          !isNaN(plane.latitude) &&
          !isNaN(plane.longitude)
      );

      // Check if the data has changed significantly
      const hasChanged =
        prevAircraftRef.current.length !== validAircraft.length ||
        validAircraft.some((plane, index) => {
          const prevPlane = prevAircraftRef.current[index];
          if (!prevPlane) return true;

          // Compare important properties
          return (
            plane.icao24 !== prevPlane.icao24 ||
            plane.latitude !== prevPlane.latitude ||
            plane.longitude !== prevPlane.longitude
          );
        });

      // If no significant change, don't reprocess
      if (!hasChanged) return;

      // Store current data for next comparison
      prevAircraftRef.current = validAircraft;

      // Start processing
      setIsProcessing(true);
      setRenderedCount(0);

      // Process in stages to maintain UI responsiveness

      // Stage 1: Quick render of a subset for immediate feedback
      const initialBatchSize = Math.min(20, validAircraft.length);
      setProcessedAircraft(validAircraft.slice(0, initialBatchSize));
      setRenderedCount(initialBatchSize);

      // Wait a frame to let the UI update
      await new Promise((resolve) => requestAnimationFrame(resolve));

      // Stage 2: Process the rest in chunks
      if (validAircraft.length > initialBatchSize) {
        const remainingAircraft = validAircraft.slice(initialBatchSize);
        const chunkSize = 10;

        let processed = [...validAircraft.slice(0, initialBatchSize)];

        await processAircraftInChunks(
          remainingAircraft,
          (plane, index) => {
            processed.push(plane);
            if (
              (index + 1) % chunkSize === 0 ||
              index === remainingAircraft.length - 1
            ) {
              setProcessedAircraft([...processed]);
              setRenderedCount(initialBatchSize + index + 1);
            }
          },
          chunkSize
        );
      }

      // Finished processing
      setIsProcessing(false);
    };

    filterAndProcess();
  }, [aircraft, isProcessing]);

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={MAP_CONFIG.CENTER}
        zoom={MAP_CONFIG.DEFAULT_ZOOM}
        className="w-full h-full"
        zoomControl={false}
      >
        <MapControllerInner />
        <ZoomControl position="bottomright" />

        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="OpenStreetMap">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="&copy; Esri"
              maxZoom={19}
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="Topographic">
            <TileLayer
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenTopoMap contributors"
              maxZoom={17}
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        {/* Render aircraft markers from processed data */}
        {processedAircraft.map((plane) => (
          <ContextAircraftMarker key={plane.icao24} aircraft={plane} />
        ))}
      </MapContainer>

      {/* Map Controls */}
      <ContextMapControls />

      {/* Status message about using new implementation */}
      <div className="absolute bottom-20 left-4 z-20 bg-blue-100 text-blue-800 px-4 py-2 rounded shadow">
        Using optimized React-based map ({renderedCount}/{aircraft.length}{' '}
        aircraft)
      </div>

      {/* Processing indicator */}
      {isProcessing && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-white px-4 py-2 rounded shadow z-50">
          Processing aircraft data: {renderedCount}/{aircraft.length}
        </div>
      )}

      {/* Selected aircraft info panel */}
      <ContextAircraftInfoPanel />
    </div>
  );
};

export default OptimizedReactBaseMap;
