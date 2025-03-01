import React, { useState, useRef, useEffect, useMemo } from 'react';
import { SelectOption } from '@/types/base';
import { useTrackedAircraft } from '../../customHooks/useTrackedAircraft';

interface ManufacturerSelectorProps {
  manufacturers: SelectOption[];
  selectedManufacturer: string | null;
  onSelect: (manufacturer: string | null) => void; // Accept null
  isLoading: boolean;
  onError?: (message: string) => void;
}

export const ManufacturerSelector: React.FC<ManufacturerSelectorProps> = ({
  manufacturers,
  selectedManufacturer,
  onSelect,
  isLoading = false,
  onError,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { startTracking, loadAircraft } =
    useTrackedAircraft(selectedManufacturer);

  // Update displayed manufacturer in the input when selectedManufacturer changes
  useEffect(() => {
    if (selectedManufacturer) {
      const selectedOption = manufacturers.find(
        (m) => m.value === selectedManufacturer
      );
      if (selectedOption) {
        setSearchTerm(selectedOption.label);
      }
    } else {
      setSearchTerm('');
    }
  }, [selectedManufacturer, manufacturers]);

  // Handler for manufacturer selection
  const handleManufacturerSelect = async (manufacturerValue: string) => {
    try {
      setIsSelecting(true);
      setIsOpen(false);

      // Call the parent component's onSelect handler
      await onSelect(manufacturerValue);
    } catch (error) {
      console.error(`Error during manufacturer selection:`, error);
      onError?.('Failed to select manufacturer');
    } finally {
      setIsSelecting(false);
    }
  };

  // Handler for reset button
  const handleReset = async () => {
    try {
      setIsSelecting(true);
      setSearchTerm('');
      setIsOpen(false);
      await onSelect(null); // This is now valid since we updated the type
    } catch (error) {
      console.error('[ManufacturerSelector] Failed to reset:', error);
      if (onError) onError('Failed to reset selection');
    } finally {
      setIsSelecting(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter manufacturers based on search term
  const filteredManufacturers = useMemo(
    () =>
      manufacturers.filter((manufacturer: SelectOption) =>
        manufacturer.label.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [manufacturers, searchTerm]
  );

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <label
        htmlFor="manufacturer-input"
        className="block text-gray-700 text-sm font-bold mb-2"
      >
        Manufacturer
        {isLoading && <span className="text-blue-500 ml-2">(Loading...)</span>}
      </label>
      <input
        id="manufacturer-input"
        type="text"
        className="w-full px-4 py-2 border rounded-md"
        placeholder="Search or select manufacturer..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => setIsOpen(true)}
        disabled={isSelecting || isLoading}
      />

      {isOpen && filteredManufacturers.length > 0 && (
        <div className="absolute w-full bg-white border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto z-50">
          {filteredManufacturers.map((manufacturer) => (
            <div
              key={manufacturer.value}
              className={`px-4 py-2 hover:bg-gray-200 cursor-pointer ${
                isSelecting || isLoading ? 'opacity-50' : ''
              } ${selectedManufacturer === manufacturer.value ? 'bg-blue-100' : ''}`}
              onClick={() =>
                !(isSelecting || isLoading) &&
                handleManufacturerSelect(manufacturer.value)
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
          disabled={isSelecting || isLoading}
        >
          Reset
        </button>
      )}
    </div>
  );
};

export default ManufacturerSelector;
