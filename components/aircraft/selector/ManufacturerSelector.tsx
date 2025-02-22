import React, { useState, useRef, useEffect } from 'react';
import { SelectOption, Aircraft, StaticModel } from '@/types/base';

interface ManufacturerSelectorProps {
  manufacturers: SelectOption[];
  selectedManufacturer: string | null;
  onSelect: (manufacturer: string | null) => Promise<void>;
  onAircraftUpdate: (aircraft: Aircraft[]) => void;
  onModelsUpdate: (models: StaticModel[]) => void; // Single declaration with StaticModel[]
  onError: (message: string) => void;
}

export const ManufacturerSelector: React.FC<ManufacturerSelectorProps> = ({
  manufacturers,
  selectedManufacturer,
  onSelect,
  onAircraftUpdate,
  onModelsUpdate,
  onError,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close dropdown
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
      />

      {isOpen && filteredManufacturers.length > 0 && (
        <div className="absolute w-full bg-white border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto z-50">
          {filteredManufacturers.map((manufacturer) => (
            <div
              key={manufacturer.value}
              className={`px-4 py-2 hover:bg-gray-200 cursor-pointer ${
                selectedManufacturer === manufacturer.value ? 'bg-blue-100' : ''
              }`}
              onClick={() => {
                onSelect(manufacturer.value);
                setSearchTerm(manufacturer.label);
                setIsOpen(false);
              }}
            >
              {manufacturer.label}
            </div>
          ))}
        </div>
      )}

      {selectedManufacturer && (
        <button
          onClick={() => {
            onSelect(null);
            setSearchTerm('');
          }}
          className="mt-2 px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600"
          type="button"
        >
          Reset
        </button>
      )}
    </div>
  );
};

export default ManufacturerSelector;
