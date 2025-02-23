import { useState, useCallback } from 'react';
import { Aircraft, ActiveModel } from '@/types/base';

interface UseAircraftSelectorProps {
  onModelsUpdate: (models: ActiveModel[]) => void;
  onAircraftUpdate: (aircraft: Aircraft[]) => void;
  onError: (message: string) => void;
}

export function useAircraftSelector({
  onModelsUpdate,
  onAircraftUpdate,
  onError,
}: UseAircraftSelectorProps) {
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [models, setModels] = useState<ActiveModel[]>([]);
  const [icao24List, setIcao24List] = useState<string[]>([]);

  // Fetch active aircraft positions (only when a model is selected)
  const fetchActiveAircraft = useCallback(
    async (icao24s: string[]) => {
      if (icao24s.length === 0) return [];

      try {
        console.log(
          `[useAircraftSelector] 📡 Fetching ${icao24s.length} aircraft positions`
        );

        const response = await fetch('/api/aircraft/icaofetcher', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ icao24s }),
        });

        if (!response.ok)
          throw new Error(`Failed to fetch positions: ${response.statusText}`);

        const responseData = await response.json();
        if (!responseData.success)
          throw new Error(responseData.error || 'Unknown error');

        return (
          responseData.data.states?.map((state: any) => ({
            icao24: state.icao24 || '',
            callsign: state.callsign || '',
            manufacturer: selectedManufacturer || '',
            model: state.model || '',
            latitude: state.latitude || 0,
            longitude: state.longitude || 0,
            altitude: state.altitude || 0,
            velocity: state.velocity || 0,
            heading: state.heading || 0,
            on_ground: state.on_ground || false,
            last_contact: state.last_contact || 0,
            isTracked: true,
          })) || []
        );
      } catch (error) {
        console.error(
          '[useAircraftSelector] ❌ Error fetching aircraft:',
          error
        );
        onError('Failed to fetch aircraft positions');
        return [];
      }
    },
    [selectedManufacturer, onError]
  );

  // Handle manufacturer selection
  const handleManufacturerSelect = useCallback(
    async (manufacturer: string | null) => {
      if (!manufacturer) {
        setSelectedManufacturer('');
        setSelectedModel('');
        setModels([]);
        setIcao24List([]);
        onModelsUpdate([]);
        onAircraftUpdate([]);
        return;
      }

      setSelectedManufacturer(manufacturer);
      setIsLoading(true);
      setSelectedModel('');
      setModels([]);
      setIcao24List([]);
      onAircraftUpdate([]); // Clear aircraft before fetching new data

      try {
        console.log(
          `[useAircraftSelector] 📡 Fetching ICAO24s and models for ${manufacturer}`
        );

        const response = await fetch(`/api/aircraft/models`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ manufacturer }),
        });

        if (!response.ok)
          throw new Error(`Failed to fetch data: ${response.statusText}`);

        const data = await response.json();
        if (!data.success)
          throw new Error(data.error || 'Failed to retrieve data');

        // Process ICAO24 list
        const icao24s = data.data.icao24List || [];
        console.log(
          `[useAircraftSelector] ✅ Received ${icao24s.length} ICAO24s`
        );
        setIcao24List(icao24s);

        // Process models
        const processedModels: ActiveModel[] =
          data.data.models?.map((model: any) => ({
            model: model.model || '',
            manufacturer: model.manufacturer || '',
            label: `${model.model} (${model.activeCount ?? 0} active)`,
            activeCount: model.activeCount ?? 0,
            totalCount: model.totalCount ?? model.count ?? 0,
          })) || [];

        console.log(
          `[useAircraftSelector] ✅ Processed ${processedModels.length} models`
        );
        setModels(processedModels);
        onModelsUpdate(processedModels);
      } catch (error) {
        console.error('[useAircraftSelector] ❌ Error:', error);
        onError('Failed to process aircraft data');
        setModels([]);
        setIcao24List([]);
        onModelsUpdate([]);
        onAircraftUpdate([]);
      } finally {
        setIsLoading(false);
      }
    },
    [onModelsUpdate, onAircraftUpdate, onError]
  );

  // Handle model selection (fetch active aircraft after model selection)
  const handleModelSelect = useCallback(
    async (model: string) => {
      setSelectedModel(model);
      if (!icao24List.length) {
        console.warn(
          '[useAircraftSelector] ⚠️ No ICAO24s available, skipping fetch'
        );
        return;
      }

      console.log(
        `[useAircraftSelector] 📡 Fetching active aircraft for model: ${model}`
      );
      const activeAircraft = await fetchActiveAircraft(icao24List);
      console.log(
        `[useAircraftSelector] ✅ Retrieved ${activeAircraft.length} active aircraft`
      );

      onAircraftUpdate(activeAircraft);
    },
    [fetchActiveAircraft, icao24List, onAircraftUpdate]
  );

  return {
    selectedManufacturer,
    selectedModel,
    models,
    isLoading,
    handleManufacturerSelect,
    handleModelSelect,
  };
}
