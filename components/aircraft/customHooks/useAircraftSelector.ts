// useAircraftSelector.ts
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
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [models, setModels] = useState<ActiveModel[]>([]);

  const fetchActiveAircraft = useCallback(
    async (icao24List: string[]) => {
      if (icao24List.length === 0) return [];

      try {
        console.log(
          `[useAircraftSelector] 📡 Fetching positions for ${icao24List.length} aircraft`
        );

        const response = await fetch('/api/aircraft/icaofetcher', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ icao24s: icao24List }),
        });

        if (!response.ok) {
          throw new Error(
            `Failed to fetch aircraft positions: ${response.statusText}`
          );
        }

        const responseData = await response.json();
        if (!responseData.success) {
          throw new Error(
            responseData.error || 'Failed to fetch aircraft positions'
          );
        }

        const activeAircraft: Aircraft[] =
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
          })) || [];

        console.log(
          `[useAircraftSelector] ✅ Processed ${activeAircraft.length} active aircraft`
        );
        return activeAircraft;
      } catch (error) {
        console.error(
          '[useAircraftSelector] ❌ Error fetching active aircraft:',
          error
        );
        onError('Failed to fetch aircraft positions');
        return [];
      }
    },
    [selectedManufacturer, onError]
  );

  // Update the handler to accept string | null
  const handleManufacturerSelect = useCallback(
    async (manufacturer: string | null) => {
      if (!manufacturer) {
        setSelectedManufacturer('');
        setSelectedModel('');
        setModels([]);
        onModelsUpdate([]);
        onAircraftUpdate([]);
        return;
      }

      setSelectedManufacturer(manufacturer);
      setIsLoadingModels(true);
      setModels([]);
      setSelectedModel('');

      try {
        // ICAO24s fetch
        console.log(
          `[useAircraftSelector] 📡 Fetching ICAO24s for ${manufacturer}`
        );
        const icaoResponse = await fetch('/api/aircraft/icao24s', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ manufacturer }),
        });

        const icaoData = await icaoResponse.json();
        const icao24List = icaoData.data?.icao24List || [];

        console.log(
          `[useAircraftSelector] ✅ Received ${icao24List.length} ICAO24s`
        );

        const activeAircraft = await fetchActiveAircraft(icao24List);
        console.log(
          `[useAircraftSelector] ✅ Retrieved ${activeAircraft.length} active positions`
        );

        onAircraftUpdate(activeAircraft);

        console.log(
          `[useAircraftSelector] 📡 Fetching models for ${manufacturer}`
        );
        const encodedManufacturer = encodeURIComponent(manufacturer || '');
        const modelsResponse = await fetch(
          `/api/aircraft/models?manufacturer=${encodedManufacturer}`
        );

        if (!modelsResponse.ok) {
          throw new Error(
            `Failed to fetch models: ${modelsResponse.statusText}`
          );
        }

        const modelsData = await modelsResponse.json();
        if (modelsData.success && Array.isArray(modelsData.data)) {
          const processedModels: ActiveModel[] = modelsData.data.map(
            (model: any) => ({
              model: model.model || '',
              manufacturer: model.manufacturer || '',
              label: `${model.model || 'Unknown'} (${model.activeCount ?? 0} active)`,
              activeCount: model.activeCount ?? 0,
              totalCount: model.totalCount ?? model.count ?? 0,
            })
          );

          console.log(
            `[useAircraftSelector] ✅ Processed ${processedModels.length} models`
          );
          setModels(processedModels);
          onModelsUpdate(processedModels);
        } else {
          console.warn(
            `[useAircraftSelector] ⚠️ No models found for ${manufacturer}`
          );
          setModels([]);
          onModelsUpdate([]);
        }
      } catch (error) {
        console.error('[useAircraftSelector] ❌ Error:', error);
        onError('Failed to process aircraft data');
        setModels([]);
        onModelsUpdate([]);
        onAircraftUpdate([]);
      } finally {
        setIsLoadingModels(false);
      }
    },
    [fetchActiveAircraft, onModelsUpdate, onAircraftUpdate, onError]
  );

  const handleModelSelect = useCallback((model: string) => {
    setSelectedModel(model);
  }, []);

  return {
    selectedManufacturer,
    selectedModel,
    models,
    isLoadingModels,
    handleManufacturerSelect,
    handleModelSelect,
  };
}
