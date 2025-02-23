import React, { useState, useRef, useEffect } from 'react';
import { SelectOption, Aircraft, StaticModel } from '@/types/base';
import { AircraftModel } from '../selector/types';

interface ManufacturerSelectorProps {
  manufacturers: SelectOption[];
  selectedManufacturer: string | null;
  onSelect: (manufacturer: string | null) => Promise<void>;
  setSelectedManufacturer: (manufacturer: string | null) => void; // Add this prop
  onAircraftUpdate: (aircraft: Aircraft[]) => void;
  onModelsUpdate: (models: AircraftModel[]) => void;
  onError: (message: string) => void;
}

// components/aircraft/tracking/selector/ManufacturerSelector.tsx
export async function trackManufacturer(
  manufacturer: string
): Promise<{ liveAircraft: string[] }> {
  try {
    console.log(
      `[Aircraft Service] 🔄 Tracking aircraft for manufacturer: ${manufacturer}`
    );

    const response = await fetch(
      `/api/aircraft/track?manufacturer=${encodeURIComponent(manufacturer)}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const data = await response.json();

    if (!data.success || !Array.isArray(data.liveAircraft)) {
      throw new Error('Invalid API response format');
    }

    return { liveAircraft: data.liveAircraft };
  } catch (error) {
    console.error('[Aircraft Service] ❌ Failed to track manufacturer:', error);
    return { liveAircraft: [] };
  }
}

export const ManufacturerSelector: React.FC<ManufacturerSelectorProps> = ({
  manufacturers,
  selectedManufacturer,
  onSelect,
  setSelectedManufacturer, // Use this prop
  onAircraftUpdate,
  onModelsUpdate,
  onError,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleManufacturerSelect = async (manufacturer: SelectOption) => {
    try {
      setIsSelecting(true);
      // Update UI state immediately
      setSelectedManufacturer(manufacturer.value);
      setSearchTerm(manufacturer.label);
      setIsOpen(false);

      // Then perform async operations
      await onSelect(manufacturer.value);
    } catch (error) {
      console.error('Failed to select manufacturer:', error);
      onError('Failed to select manufacturer');
      // Rollback on error
      setSelectedManufacturer(null);
      setSearchTerm('');
    } finally {
      setIsSelecting(false);
    }
  };

  const handleReset = async () => {
    try {
      setIsSelecting(true);
      setSelectedManufacturer(null);
      setSearchTerm('');
      setIsOpen(false);
      await onSelect(null);
    } catch (error) {
      console.error('Failed to reset:', error);
      onError('Failed to reset selection');
    } finally {
      setIsSelecting(false);
    }
  };

  const filteredManufacturers = manufacturers.filter((manufacturer) =>
    manufacturer.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <input
        type="text"
        className="w-full px-4 py-2 border rounded-md"
        placeholder="Search or select manufacturer..."
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        disabled={isSelecting}
      />

      {isOpen && filteredManufacturers.length > 0 && (
        <div className="absolute w-full bg-white border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto z-50">
          {filteredManufacturers.map((manufacturer) => (
            <div
              key={manufacturer.value}
              className={`px-4 py-2 hover:bg-gray-200 cursor-pointer ${
                isSelecting ? 'opacity-50' : ''
              } ${selectedManufacturer === manufacturer.value ? 'bg-blue-100' : ''}`}
              onClick={() =>
                !isSelecting && handleManufacturerSelect(manufacturer)
              }
            >
              {manufacturer.label}
            </div>
          ))}
        </div>
      )}

      {selectedManufacturer && (
        <button
          onClick={handleReset}
          className="mt-2 px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50"
          type="button"
          disabled={isSelecting}
        >
          Reset
        </button>
      )}
    </div>
  );
};

export default ManufacturerSelector;
