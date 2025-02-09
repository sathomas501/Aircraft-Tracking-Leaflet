import React, { useState, useEffect } from 'react';
import ManufacturerSelector from '../../selector/ManufacturerSelector';
import ModelSelector from '../../selector/ModelSelector';
import NNumberSelector from '../../selector/nNumberSelector';
import DynamicMap from '../Map/DynamicMap';
import { Aircraft, SelectOption } from '@/types/base';
import { transformAircraft } from '@/utils/aircraft-transform'; // ✅ Ensure correct import path
import { Model } from '../../selector/services/aircraftService';

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
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [nNumber, setNNumber] = useState<string>('');
  const [models, setModels] = useState<Model[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);

  useEffect(() => {
    setIsMapReady(true);
  }, []);

  // Transform aircraft to ExtendedAircraft format
  const transformToExtendedAircraft = (
    aircraft: Aircraft[]
  ): ExtendedAircraft[] => {
    return aircraft.map((plane) => ({
      ...plane,
      type: plane.OWNER_TYPE === '5' ? 'Government' : 'Non-Government',
      isGovernment: plane.OWNER_TYPE === '5',
    }));
  };

  // Fetch aircraft when manufacturer is selected
  const handleManufacturerSelect = async (manufacturer: string) => {
    setSelectedManufacturer(manufacturer);
    setSelectedModel(''); // ✅ Reset model when manufacturer changes
    setModels([]); // ✅ Clear models when selecting a new manufacturer

    try {
      // Fetch aircraft data for selected manufacturer
      const response = await fetch('/api/aircraft/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer }),
      });

      if (!response.ok) {
        console.error(
          `HTTP Error: ${response.status} - ${response.statusText}`
        );
        throw new Error(`Error fetching aircraft data: ${response.statusText}`);
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('JSON Parse Error:', jsonError);
        throw new Error('Failed to parse server response');
      }

      if (!data.aircraft || !Array.isArray(data.aircraft)) {
        console.error('Unexpected API Response:', data);
        throw new Error('Invalid aircraft data format received from API');
      }

      setDisplayedAircraft(transformToExtendedAircraft(data.aircraft)); // ✅ Update aircraft list
    } catch (error) {
      console.error('Aircraft Fetch Error:', error);
      if (error instanceof Error) {
        alert(`Failed to load aircraft data: ${error.message}`);
      } else {
        alert('Failed to load aircraft data');
      }
    }

    // ✅ Fetch only models related to the selected manufacturer
    try {
      const modelsResponse = await fetch(
        `/api/models?manufacturer=${manufacturer}`
      );
      const modelsData = await modelsResponse.json();

      if (!modelsData.models || !Array.isArray(modelsData.models)) {
        console.error('Unexpected Models API Response:', modelsData);
        throw new Error('Invalid models data format received from API');
      }

      setModels(
        modelsData.models.map((model: { model: string }) => ({
          ...model,
          label: model.model,
        })) || []
      ); // ✅ Only store models for this manufacturer
    } catch (error) {
      console.error('Error fetching models:', error);
    }
  };

  // Filter aircraft by model
  const handleModelSelect = (model: string) => {
    setSelectedModel(model);
    setDisplayedAircraft((prevAircraft) =>
      model
        ? prevAircraft.filter((plane) => plane.model === model)
        : prevAircraft
    );
  };

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

  return (
    <div className="relative w-full h-screen">
      {/* Debug Info */}
      <div className="absolute top-0 right-0 z-50 bg-white p-2 text-xs">
        Aircraft: {displayedAircraft.length} | Selected Mfr:{' '}
        {selectedManufacturer || 'none'} | Model: {selectedModel || 'none'} |
        Map Ready: {isMapReady ? 'yes' : 'no'}
      </div>

      {/* Manufacturer Selector */}
      <div className="absolute top-4 left-4 z-10 max-w-sm">
        <ManufacturerSelector
          onSelect={handleManufacturerSelect}
          selectedManufacturer={selectedManufacturer}
          manufacturers={manufacturers}
          onAircraftUpdate={(aircraft) =>
            setDisplayedAircraft(transformToExtendedAircraft(aircraft))
          } // ✅ Fix type mismatch
          onModelsUpdate={setModels}
        />
      </div>

      {/* Model Selector */}
      {selectedManufacturer && (
        <div className="absolute top-20 left-4 z-10 max-w-sm">
          <ModelSelector
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            selectedManufacturer={selectedManufacturer}
            models={models} // ✅ Only pass necessary props
            totalActive={displayedAircraft.length}
            onModelUpdate={handleModelSelect}
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
