import React, { useState, useCallback, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type {
  Aircraft,
  SelectOption,
  ExtendedAircraft,
} from '../../../../types/base';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
// Keep your original data fetching hooks
import { useFetchManufacturers } from '../../../../hooks/useFetchManufactures';
import { useOpenSkyData } from '../../../../hooks/useOpenSkyData';
import { useFetchModels } from '../../../../hooks/useFetchModels';
// Import the new simplified component
import AircraftSelector from '../../../AircraftSelector';

const DynamicMap = dynamic(() => import('../Map/DynamicMap'), {
  ssr: false,
  loading: () => <LoadingSpinner message="Loading map..." />,
});

export interface MapWrapperProps {
  initialAircraft?: Aircraft[];
  manufacturers?: SelectOption[];
  onError: (message: string) => void;
}

const MapWrapper: React.FC<MapWrapperProps> = ({ onError, manufacturers: propManufacturers }) => {
  // Fetch manufacturers using your existing hook
  const { manufacturers: fetchedManufacturers, loading: loadingManufacturers, error: manufacturersError } =
    useFetchManufacturers();
    
  // Use provided manufacturers or fetched ones
  const manufacturers = propManufacturers?.length ? propManufacturers : fetchedManufacturers;
  
  // State for tracking aircraft and UI
  const [selectedManufacturer, setSelectedManufacturer] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [displayedAircraft, setDisplayedAircraft] = useState<ExtendedAircraft[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Log when manufacturers data changes
  useEffect(() => {
    console.log(`[MapWrapper] Manufacturers loaded: ${manufacturers.length}`);
  }, [manufacturers]);

  // Fetch aircraft tracking data based on selected manufacturer
  const { trackedAircraft, isInitializing, trackingStatus } =
    useOpenSkyData(selectedManufacturer);
    
  // Fetch models based on selected manufacturer
  const { models, loading: loadingModels } = 
    useFetchModels(selectedManufacturer || null);

  // Determine if we're in a loading state
  const isLoading = isInitializing || loadingModels || loadingManufacturers;

  // Process aircraft for display
  const processAircraft = useCallback((aircraft: Aircraft[]) => {
    console.log(`[MapWrapper] Processing ${aircraft.length} aircraft`);
    
    // Filter by selected model if applicable
    const filtered = selectedModel
      ? aircraft.filter(a => a.model === selectedModel || a.TYPE_AIRCRAFT === selectedModel)
      : aircraft;
      
    // Transform to extended aircraft for the map
    const extended = filtered.map((a) => ({
      ...a,
      type: a.TYPE_AIRCRAFT || 'Unknown',
      isGovernment: a.OWNER_TYPE === '5',
    })) as ExtendedAircraft[];
    
    setDisplayedAircraft(extended);
  }, [selectedModel]);

  // Update displayed aircraft when tracked aircraft changes
  useEffect(() => {
    if (trackedAircraft?.length) {
      processAircraft(trackedAircraft);
    }
  }, [trackedAircraft, processAircraft]);

  // Update status message when tracking status changes
  useEffect(() => {
    if (trackingStatus) {
      setStatusMessage(trackingStatus);
    }
  }, [trackingStatus]);

  // Handle manufacturer selection from the selector
  const handleManufacturerSelect = useCallback((manufacturer: string | null) => {
    console.log(`[MapWrapper] Selected manufacturer: ${manufacturer}`);
    setSelectedManufacturer(manufacturer);
    setSelectedModel(null);
  }, []);

  // Handle model selection from the selector
  const handleModelSelect = useCallback((model: string | null) => {
    console.log(`[MapWrapper] Selected model: ${model}`);
    setSelectedModel(model);
    
    // Re-process aircraft to filter by the new model
    if (trackedAircraft?.length) {
      const filtered = model
        ? trackedAircraft.filter(a => a.model === model || a.TYPE_AIRCRAFT === model)
        : trackedAircraft;
        
      processAircraft(filtered);
    }
  }, [trackedAircraft, processAircraft]);

  // Handle aircraft selection changes from the component
  const handleAircraftChange = useCallback((aircraft: Aircraft[]) => {
    // This will be called by the AircraftSelector when the selection changes
    console.log(`[MapWrapper] Aircraft selection changed: ${aircraft.length} aircraft`);
    processAircraft(aircraft);
  }, [processAircraft]);

  // Handle status changes from the component
  const handleStatusChange = useCallback((status: string) => {
    console.log(`[MapWrapper] Status: ${status}`);
    setStatusMessage(status);
  }, []);

  // Handle error messages from the component
  const handleError = useCallback((errorMessage: string) => {
    console.error(`[MapWrapper] Error: ${errorMessage}`);
    onError(errorMessage);
  }, [onError]);

  // Pass through manufacturers to the AircraftSelector
  const handleLoadManufacturers = useCallback(() => {
    return Promise.resolve(manufacturers);
  }, [manufacturers]);

  return (
    <div className="relative w-full h-screen">
      <div className="absolute inset-0">
        <DynamicMap aircraft={displayedAircraft} onError={onError} />
      </div>

      <div className="absolute top-0 left-0 right-0 z-10 max-w-sm ml-4">
        {/* Use enhanced props to connect your existing logic with the new component */}
        <AircraftSelector
          initialManufacturer={selectedManufacturer}
          initialModel={selectedModel}
          onAircraftChange={handleAircraftChange}
          onStatusChange={handleStatusChange}
          onError={handleError}
          autoPolling={false}
        />
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute top-4 right-4 z-20">
          <LoadingSpinner
            message={
              loadingManufacturers ? 'Loading manufacturers...' : 
              loadingModels ? 'Loading models...' : 
              'Tracking aircraft...'
            }
          />
        </div>
      )}

      {/* Status message */}
      {statusMessage && !isLoading && (
        <div className="absolute bottom-4 right-4 z-20 bg-white p-2 rounded shadow">
          <p className="text-sm">{statusMessage}</p>
        </div>
      )}
      
      {/* Debug info */}
      <div className="absolute bottom-4 left-4 z-20 bg-white p-2 rounded shadow text-xs">
        <p>Manufacturers: {manufacturers.length}</p>
        <p>Models: {models.length}</p>
        <p>Aircraft: {trackedAircraft?.length || 0}</p>
        <p>Displayed: {displayedAircraft.length}</p>
      </div>
    </div>
  );
};

export default MapWrapper;