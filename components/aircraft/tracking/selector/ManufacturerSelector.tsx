// SimplifiedManufacturerSelector.tsx
import React, { useState, useRef, useEffect } from 'react';
import { SelectOption } from '@/types/base';

interface ManufacturerSelectorProps {
  manufacturers: SelectOption[];
  selectedManufacturer: string | null;
  onSelect: (manufacturer: string | null) => void;
  isLoading?: boolean;
}

const ManufacturerSelector: React.FC<ManufacturerSelectorProps> = ({
  manufacturers,
  selectedManufacturer,
  onSelect,
  isLoading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update search term when selection changes
  useEffect(() => {
    if (selectedManufacturer) {
      const selected = manufacturers.find(
        (m) => m.value === selectedManufacturer
      );
      if (selected) setSearchTerm(selected.label);
    } else {
      setSearchTerm('');
    }
  }, [selectedManufacturer, manufacturers]);

  // Handle clicks outside the dropdown
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
        disabled={isLoading}
      />

      {isOpen && filteredManufacturers.length > 0 && (
        <div className="absolute w-full bg-white border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto z-50">
          {filteredManufacturers.map((manufacturer) => (
            <div
              key={manufacturer.value}
              className={`px-4 py-2 hover:bg-gray-200 cursor-pointer 
                ${isLoading ? 'opacity-50' : ''} 
                ${selectedManufacturer === manufacturer.value ? 'bg-blue-100' : ''}`}
              onClick={() => {
                if (!isLoading) {
                  onSelect(manufacturer.value);
                  setIsOpen(false);
                }
              }}
            >
              {manufacturer.label}
            </div>
          ))}
        </div>
      )}

      {selectedManufacturer && (
        <button
          onClick={() => onSelect(null)}
          className="mt-2 px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50"
          type="button"
          disabled={isLoading}
        >
          Clear
        </button>
      )}
    </div>
  );
};

export default ManufacturerSelector;
