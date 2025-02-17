import React, { useState, useEffect, useRef } from 'react';
import ManufacturerSelector from '../../selector/ManufacturerSelector';
import ModelSelector from '../../selector/ModelSelector';
import NNumberSelector from '../../selector/nNumberSelector';
import DynamicMap from '../Map/DynamicMap';
import { Aircraft, SelectOption, Model, StaticModel } from '@/types/base';

interface ExtendedAircraft extends Aircraft {
  type: string;
  isGovernment: boolean;
}

interface MapComponentProps {
  initialAircraft?: Aircraft[];
  manufacturers: SelectOption[];
}

const MapComponent: React.FC<MapComponentProps> = ({
  initialAircraft = [],
  manufacturers,
}) => {
  const [displayedAircraft, setDisplayedAircraft] = useState<
    ExtendedAircraft[]
  >([]);
  const [selectedManufacturer, setSelectedManufacturer] = useState<
    string | null
  >(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [totalActive, setTotalActive] = useState(0);
  const [nNumber, setNNumber] = useState<string>('');
  const [models, setModels] = useState<Model[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  // Function to update displayed aircraft list
  const handleAircraftUpdate = (aircraft: Aircraft[]) => {
    setDisplayedAircraft(transformToExtendedAircraft(aircraft));
  };

  // Or better yet, create a separate function for clarity:
  const calculateTotalActive = (models: Model[]): number => {
    return models.reduce(
      (sum: number, model: Model) => sum + (model.activeCount || 0),
      0
    );
  };

  // Function to update model list when a manufacturer is selected
  const handleModelsUpdate = (models: Model[]) => {
    setModels(models);
    setTotalActive(models.reduce((sum, m) => sum + (m.activeCount || 0), 0));
  };

  const handleError = (message: string) => {
    console.error(`[Error]: ${message}`);
    alert(`Error: ${message}`);
  };

  useEffect(() => {
    setIsMapReady(true);
  }, []);

  // Transform aircraft to ExtendedAircraft format
  const transformToExtendedAircraft = (
    aircraft: Aircraft[]
  ): ExtendedAircraft[] => {
    return aircraft.map((plane) => ({
      ...plane,
      type: plane.TYPE_AIRCRAFT || 'Unknown', // Ensure 'type' is set
      isGovernment: plane.OWNER_TYPE?.toLowerCase() === 'government' || false, // Ensure 'isGovernment' is boolean
    }));
  };

  // Fetch aircraft when manufacturer is selected
  const handleManufacturerSelect = async (
    manufacturer: string | null
  ): Promise<ExtendedAircraft[]> => {
    stopPolling(); // Stop existing polling
    setSelectedManufacturer(manufacturer);
    setSelectedModel('');
    setModels([]);

    if (!manufacturer) {
      setDisplayedAircraft([]);
      return []; // Return empty array when no manufacturer is selected
    }

    try {
      // Fetch active aircraft using getTrackedAircraft action
      const response = await fetch('/api/aircraft/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getTrackedAircraft',
          manufacturer,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      const data = await response.json();
      let aircraftList: Aircraft[] = [];

      if (data.aircraft) {
        // Filter aircraft by manufacturer if needed
        aircraftList = data.aircraft.filter(
          (ac: Aircraft) =>
            ac.manufacturer?.toLowerCase() === manufacturer.toLowerCase()
        );
      }

      // Convert to ExtendedAircraft[]
      const extendedAircraftList = transformToExtendedAircraft(aircraftList);
      setDisplayedAircraft(extendedAircraftList);

      // Fetch active models
      const modelsResponse = await fetch(
        `/api/aircraft/models?manufacturer=${encodeURIComponent(manufacturer)}`
      );

      if (!modelsResponse.ok) {
        throw new Error(`Error: ${modelsResponse.statusText}`);
      }

      const modelsData = await modelsResponse.json();
      if (modelsData.data) {
        const processedModels = modelsData.data.map(
          (model: { model: string; activeCount: number }) => ({
            model: model.model,
            label: `${model.model} (${model.activeCount || 0} active)`,
            activeCount: model.activeCount || 0,
          })
        );
        setModels(processedModels);
        setTotalActive(calculateTotalActive(processedModels));
      }

      // Start polling after successful initial fetch
      startPolling();

      return extendedAircraftList;
    } catch (error) {
      console.error('[ManufacturerSelect] ❌ Error:', error);
      if (error instanceof Error) {
        alert(`Failed to load data: ${error.message}`);
      }
      stopPolling(); // Ensure polling is stopped on error
      setDisplayedAircraft([]); // Clear displayed aircraft on error
      return [];
    }
  };
  // Filter aircraft by model
  const handleModelSelect = (model: string) => {
    setSelectedModel(model);
    // If a model is selected, filter the continuously polled aircraft
    if (model) {
      setDisplayedAircraft((prev) =>
        prev.filter((plane) => plane.model === model)
      );
    } else {
      // If no model selected, show all aircraft for the manufacturer
      pollTrackingDatabase();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  // Search aircraft by N-Number
  const handleNNumberSearch = async (nNumber: string) => {
    try {
      const response = await fetch(`/api/aircraft/search?nNumber=${nNumber}`);
      if (!response.ok) throw new Error(`Error: ${response.statusText}`);

      const data = await response.json();
      if (!data.aircraft) throw new Error('No aircraft found.');

      setDisplayedAircraft(transformToExtendedAircraft(data.aircraft)); // ✅ Fix type issue
    } catch (error) {
      console.error(error);
    }
  };

  // Reset filters
  const handleReset = () => {
    setSelectedManufacturer('');
    setSelectedModel('');
    setNNumber('');
    setDisplayedAircraft(transformToExtendedAircraft(initialAircraft));
  };

  // Function to poll tracking database
  const pollTrackingDatabase = async () => {
    try {
      const response = await fetch('/api/aircraft/tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'getTrackedAircraft',
        }),
      });
      const data = await response.json();
      return data.aircraft;
    } catch (error) {
      console.error('[Tracking] ❌ Failed to poll tracking database:', error);
      return [];
    }
  };

  // Function to start polling
  const startPolling = () => {
    if (!isPolling) {
      setIsPolling(true);
      pollTrackingDatabase(); // Initial poll
      pollingInterval.current = setInterval(pollTrackingDatabase, 5000);
    }
  };

  // Function to stop polling
  const stopPolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
    setIsPolling(false);
  };

  const formatModelsForSelector = (inputModels: Model[]): StaticModel[] => {
    return inputModels.map((model) => ({
      model: model.model,
      manufacturer: model.manufacturer || '',
      label: model.label || `${model.model} (${model.activeCount || 0} active)`,
      count: model.activeCount || 0, // Ensure count is always a number
    }));
  };

  return (
    <div className="relative w-full h-screen">
      {/* Debug Info */}
      <div className="absolute top-0 right-0 z-50 bg-white p-2 text-xs">
        Aircraft: {displayedAircraft.length} | Selected Mfr:{' '}
        {selectedManufacturer || 'none'} | Model: {selectedModel || 'none'} |
        Polling: {isPolling ? 'yes' : 'no'} | Active: {totalActive}
      </div>

      {/* Manufacturer Selector */}
      <div className="absolute top-4 left-4 z-10 max-w-sm">
        <ManufacturerSelector
          onSelect={handleManufacturerSelect}
          selectedManufacturer={selectedManufacturer}
          setSelectedManufacturer={setSelectedManufacturer}
          manufacturers={manufacturers} // This should already be SelectOption[]
          onAircraftUpdate={handleAircraftUpdate}
          onModelsUpdate={handleModelsUpdate}
          onError={handleError}
        />
      </div>

      {/* Model Selector */}
      {selectedManufacturer && (
        <div className="absolute top-20 left-4 z-10 max-w-sm">
          <ModelSelector
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            models={formatModelsForSelector(models)}
            totalActive={totalActive}
            onModelSelect={handleModelSelect}
          />
        </div>
      )}

      {/* N-Number Selector */}
      <div className="absolute top-36 left-4 z-10 max-w-sm">
        <NNumberSelector
          nNumber={nNumber}
          setNNumber={setNNumber}
          onSearch={handleNNumberSearch} // ✅ Now calls parent function
        />
      </div>

      {/* Reset Button */}
      <button
        onClick={handleReset}
        className="absolute top-48 left-4 z-10 bg-red-500 text-white p-2 rounded"
      >
        Reset Filters
      </button>

      {/* Map Display */}
      {isMapReady && (
        <div className="absolute inset-0">
          <DynamicMap aircraft={displayedAircraft} />
        </div>
      )}
    </div>
  );
};

export default MapComponent;
