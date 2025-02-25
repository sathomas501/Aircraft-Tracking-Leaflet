import React, { useState, useRef, useEffect, useMemo } from 'react';
import { SelectOption } from '@/types/base';
import { fetchAircraftByManufacturer } from './services/aircraftService';

interface ManufacturerSelectorProps {
  manufacturers: SelectOption[];
  selectedManufacturer: string | null;
  /**
   * Called when a manufacturer is selected (or reset with null).
   */
  onSelect: (manufacturer: string | null) => void;
  /**
   * Optional callback for when aircraft data is fetched
   */
  onAircraftFetched?: (aircraft: Array<{ icao24: string }>) => void;
}

const ManufacturerSelector: React.FC<ManufacturerSelectorProps> = ({
  manufacturers,
  selectedManufacturer,
  onSelect,
  onAircraftFetched,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter manufacturers by search term
  const filteredManufacturers = useMemo(
    () =>
      manufacturers.filter((manufacturer) =>
        manufacturer.label.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [manufacturers, searchTerm]
  );

  // Handle manufacturer selection and trigger ICAO fetch
  const handleManufacturerSelect = async (manufacturer: string) => {
    setIsLoading(true);
    try {
      onSelect(manufacturer);
      const aircraft = await fetchAircraftByManufacturer(manufacturer);
      if (onAircraftFetched) {
        onAircraftFetched(aircraft);
      }
    } catch (error) {
      console.error('Error fetching aircraft:', error);
    } finally {
      setIsLoading(false);
      setIsOpen(false);
    }
  };

  // Handle reset
  const handleReset = () => {
    onSelect(null);
    if (onAircraftFetched) {
      onAircraftFetched([]);
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

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="relative">
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
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
          </div>
        )}
      </div>

      {isOpen && filteredManufacturers.length > 0 && (
        <div className="absolute w-full bg-white border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto z-50">
          {filteredManufacturers.map((manufacturer) => (
            <div
              key={manufacturer.value}
              className={`px-4 py-2 hover:bg-gray-200 cursor-pointer ${
                selectedManufacturer === manufacturer.value ? 'bg-blue-100' : ''
              }`}
              onClick={() => handleManufacturerSelect(manufacturer.value)}
            >
              {manufacturer.label}
            </div>
          ))}
        </div>
      )}

      {selectedManufacturer && (
        <button
          onClick={handleReset}
          className="mt-2 px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600"
          type="button"
          disabled={isLoading}
        >
          Reset
        </button>
      )}
    </div>
  );
};

export default ManufacturerSelector;
