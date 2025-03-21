// components/tracking/Map/MapContextWrapper.tsx
import React from 'react';
import { MapProvider } from '../context/MapContext';
import type { ExtendedAircraft } from '@/types/base';
import LeafletMap from '../../aircraft/tracking/Map/LeafletMap';
import MapController from './components/MapController';
import { useMapContext } from '../context/MapContext';

interface MapContextWrapperProps {
  aircraft: ExtendedAircraft[];
  onError: (message: string) => void;
}

const MapContextWrapper: React.FC<MapContextWrapperProps> = ({
  aircraft,
  onError,
}) => {
  return (
    <MapProvider>
      <WrappedMap aircraft={aircraft} onError={onError} />
    </MapProvider>
  );
};
/**
 * MapContextWrapper
 *
 * This is a bridge component that wraps the existing LeafletMap
 * with our new context provider. It helps with the migration
 * without requiring a complete rewrite.
 */
const WrappedMap: React.FC<MapContextWrapperProps> = ({
  aircraft,
  onError,
}) => {
  const { preserveView } = useMapContext();

  return (
    <LeafletMap
      aircraft={aircraft}
      onError={onError}
      preserveView={preserveView}
    />
  );
};

export default MapContextWrapper;
