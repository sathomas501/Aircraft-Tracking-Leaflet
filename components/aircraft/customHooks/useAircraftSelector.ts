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
  const [selectedManufacturer, setSelectedManufacturer] = useState<
    string | null
  >(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [models, setModels] = useState<ActiveModel[]>([]);

  const fetchActiveAircraft = useCallback(
    async (icao24List: string[]) => {
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

        // Extract the aircraft states and transform them into Aircraft objects
        const activeAircraft = (responseData.data.states || []).map(
          (state: any) => ({
            icao24: state.icao24,
            callsign: state.callsign,
            manufacturer: selectedManufacturer || '',
            model: state.model || '',
            latitude: state.latitude,
            longitude: state.longitude,
            altitude: state.altitude,
            velocity: state.velocity,
            heading: state.heading,
            on_ground: state.on_ground,
            last_contact: state.last_contact,
            isTracked: true,
          })
        );

        console.log(
          `[useAircraftSelector] ✅ Processed ${activeAircraft.length} active aircraft`
        );
        return activeAircraft;
      } catch (error) {
        console.error(
          '[useAircraftSelector] ❌ Error fetching active aircraft:',
          error
        );
        return [];
      }
    },
    [selectedManufacturer]
  );

  const handleManufacturerSelect = useCallback(
    async (manufacturer: string | null) => {
      if (!manufacturer) {
        setSelectedManufacturer(null);
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
        // Step 1: Get ICAO24s
        const icaoResponse = await fetch('/api/aircraft/icao24s', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ manufacturer }),
        });

        if (!icaoResponse.ok) {
          throw new Error(
            `Failed to fetch ICAO24s: ${icaoResponse.statusText}`
          );
        }

        const icaoData = await icaoResponse.json();
        const icao24List = icaoData.data?.icao24List || [];

        console.log(
          `[useAircraftSelector] ✅ Received ${icao24List.length} ICAO24s`
        );

        // Step 2: Get active aircraft positions
        const activeAircraft = await fetchActiveAircraft(icao24List);
        console.log(
          `[useAircraftSelector] ✅ Retrieved ${activeAircraft.length} active positions`
        );

        // Important: Update aircraft positions BEFORE fetching models
        onAircraftUpdate(activeAircraft);

        // Step 3: Fetch models with active count information
        const modelsResponse = await fetch(
          `/api/aircraft/models?manufacturer=${encodeURIComponent(manufacturer)}`
        );

        if (!modelsResponse.ok) {
          throw new Error(
            `Failed to fetch models: ${modelsResponse.statusText}`
          );
        }

        const modelsData = await modelsResponse.json();
        if (modelsData.success && Array.isArray(modelsData.data)) {
          const processedModels = modelsData.data.map((model: any) => ({
            model: model.model,
            manufacturer: model.manufacturer,
            label: `${model.model} (${model.activeCount} active)`,
            count: model.count || 0,
            activeCount: model.activeCount || 0,
            totalCount: model.count || 0,
          }));

          setModels(processedModels);
          onModelsUpdate(processedModels);
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

  return {
    selectedManufacturer,
    selectedModel,
    models,
    isLoadingModels,
    setSelectedModel,
    handleManufacturerSelect,
  };
}
