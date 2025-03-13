import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type {
  Aircraft,
  SelectOption,
  ExtendedAircraft,
} from '../../../../types/base';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import AircraftSelector from '../../../AircraftSelector';

const DynamicMap = dynamic(() => import('../Map/DynamicMap'), {
  ssr: false,
  loading: () => <LoadingSpinner message="Loading map..." />,
});

export interface MapComponentProps {
  manufacturers: SelectOption[];
  onError: (message: string) => void;
}

const MapComponent: React.FC<MapComponentProps> = ({
  manufacturers,
  onError,
}) => {
  // State declarations
  const [displayedAircraft, setDisplayedAircraft] = useState<ExtendedAircraft[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Handler functions for AircraftSelector
  const handleAircraftChange = useCallback((aircraft: Aircraft[]) => {
    console.log(`[MapComponent] Aircraft updated: ${aircraft.length}`);
    
    // Transform to extended aircraft
    const extendedAircraft = aircraft.map((a) => ({
      ...a,
      type: a.TYPE_AIRCRAFT || 'Unknown',
      isGovernment: a.OWNER_TYPE === '5',
    })) as ExtendedAircraft[];
    
    setDisplayedAircraft(extendedAircraft);
  }, []);

  const handleStatusChange = useCallback((status: string) => {
    console.log(`[MapComponent] Status: ${status}`);
    setStatusMessage(status);
  }, []);

  const handleError = useCallback((errorMessage: string) => {
    console.error(`[MapComponent] Error: ${errorMessage}`);
    onError(errorMessage);
  }, [onError]);

  return (
    <div className="relative w-full h-screen">
      <div className="absolute inset-0">
        <DynamicMap aircraft={displayedAircraft} onError={onError} />
      </div>

      <div className="absolute top-0 left-0 right-0 z-10 max-w-sm ml-4">
        <AircraftSelector
          onAircraftChange={handleAircraftChange}
          onStatusChange={handleStatusChange}
          onError={handleError}
          autoPolling={false}
        />
      </div>

      {/* Status message */}
      {statusMessage && (
        <div className="absolute bottom-4 right-4 z-20 bg-white p-2 rounded shadow">
          <p className="text-sm">{statusMessage}</p>
        </div>
      )}
    </div>
  );
};

export default MapComponent;