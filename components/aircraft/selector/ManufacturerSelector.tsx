import React, { useEffect, useCallback, useMemo } from 'react';
import type { Aircraft, SelectOption } from '@/types/base';
import { useFetchManufacturers } from '../customHooks/useFetchManufactures';
import { clientTrackingService } from '../../../lib/services/tracking-services/client-tracking-service';

interface ManufacturerSelectorProps {
  onSelect: (manufacturer: string) => Promise<void>;
  selectedManufacturer: string;
  setSelectedManufacturer: (manufacturer: string) => void; // ✅ Added this
  manufacturers: SelectOption[];
  onAircraftUpdate: (aircraft: Aircraft[]) => void;
  onModelsUpdate: (
    models: {
      model: string;
      label: string;
      activeCount?: number;
      count?: number;
    }[]
  ) => void;
  onError: (message: string) => void; // ✅ Ensure this is included
}

const ManufacturerSelector: React.FC<ManufacturerSelectorProps> = ({
  onSelect,
  selectedManufacturer,
  setSelectedManufacturer, // ✅ Now included
  manufacturers: externalManufacturers,
  onAircraftUpdate,
  onModelsUpdate,
  onError, // ✅ Now included
}) => {
  const {
    searchTerm,
    setSearchTerm,
    loading: hookLoading,
  } = useFetchManufacturers();

  // Filter manufacturers based on search
  const filteredManufacturers = useMemo(() => {
    return externalManufacturers.filter(
      (m: SelectOption) =>
        m.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.value.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [externalManufacturers, searchTerm]);

  // Handle manufacturer selection
  const handleManufacturerSelect = useCallback(
    async (manufacturer: string) => {
      if (
        manufacturer === selectedManufacturer &&
        !clientTrackingService.isTrackingActive()
      ) {
        console.log(
          `[Tracking] ❌ No active aircraft previously found. Not restarting.`
        );
        return;
      }

      try {
        setSelectedManufacturer(manufacturer); // ✅ Fixing missing function
        clientTrackingService.setTrackingActive(true);
        await clientTrackingService.startTracking(manufacturer);
      } catch (error) {
        console.error('Failed to fetch aircraft:', error);
        if (onError) {
          onError('Failed to fetch aircraft data'); // ✅ Fixing missing function
        }
      }
    },
    [selectedManufacturer, setSelectedManufacturer, onError]
  );

  // Subscribe to manufacturer updates
  useEffect(() => {
    if (selectedManufacturer) {
      const unsubscribe = clientTrackingService.subscribe(
        selectedManufacturer,
        (aircraft) => {
          onAircraftUpdate(aircraft);

          // Update models with proper type checking
          const modelsMap = aircraft.reduce(
            (acc, a) => {
              if (a.model && typeof a.model === 'string') {
                if (!acc.has(a.model)) {
                  acc.set(a.model, {
                    model: a.model,
                    label: a.model,
                    activeCount: 0,
                    count: 0,
                  });
                }
                const modelData = acc.get(a.model)!;
                modelData.activeCount = (modelData.activeCount || 0) + 1;
                modelData.count = (modelData.count || 0) + 1;
              }
              return acc;
            },
            new Map<
              string,
              {
                model: string;
                label: string;
                activeCount: number;
                count: number;
              }
            >()
          );

          const models = Array.from(modelsMap.values());

          if (models.length > 0) {
            onModelsUpdate(models);
          }
        }
      );

      return unsubscribe;
    }
  }, [selectedManufacturer, onAircraftUpdate, onModelsUpdate]);

  const handleSelect = async (manufacturer: string) => {
    try {
      setSearchTerm(manufacturer);
      await onSelect(manufacturer); // This is the prop passed from MapWrapper
    } catch (error) {
      console.error('Error in manufacturer selection:', error);
    }
  };

  return (
    <div className="relative w-full">
      <label className="block text-sm font-medium text-gray-600">
        Manufacturer
      </label>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search or select manufacturer..."
        className="w-full p-2 pl-8 border border-gray-300 rounded-md shadow-sm
             focus:ring-blue-500 focus:border-blue-500
             bg-white text-gray-900"
      />

      {/* Manufacturer Dropdown */}
      {hookLoading ? (
        <p className="text-sm text-gray-500 mt-1">Loading manufacturers...</p>
      ) : filteredManufacturers.length > 0 ? (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredManufacturers.map((manufacturer: SelectOption) => (
            <li
              key={manufacturer.value}
              className={`px-4 py-2 text-left hover:bg-gray-100 flex justify-between cursor-pointer
          ${manufacturer.value === selectedManufacturer ? 'bg-blue-50' : ''}`}
              onClick={() => handleManufacturerSelect(manufacturer.value)}
            >
              <span>{manufacturer.label}</span>
              <span className="text-sm text-gray-500">
                {manufacturer.activeCount && manufacturer.activeCount > 0
                  ? `${manufacturer.activeCount.toLocaleString()} active / ${manufacturer.count?.toLocaleString()} total`
                  : `${manufacturer.count?.toLocaleString()} total`}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 mt-1">No manufacturers found.</p>
      )}
    </div>
  );
};

export default ManufacturerSelector;
