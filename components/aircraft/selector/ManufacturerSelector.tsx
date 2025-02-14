// ManufacturerSelector.tsx
import { useState, useEffect, useRef } from 'react';

interface ManufacturerSelectorProps {
  manufacturers: string[];
  selectedManufacturer: string | null;
  setSelectedManufacturer: (manufacturer: string | null) => void;
  onSelect: (manufacturer: string | null) => Promise<void>;
}

const ManufacturerSelector: React.FC<ManufacturerSelectorProps> = ({
  manufacturers,
  selectedManufacturer,
  onSelect,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredManufacturers, setFilteredManufacturers] =
    useState(manufacturers);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const filtered = manufacturers.filter((manufacturer) =>
      manufacturer.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredManufacturers(filtered);
  }, [searchTerm, manufacturers]);

  const handleSelect = (manufacturer: string) => {
    onSelect(manufacturer);
    setSearchTerm(manufacturer);
    setIsOpen(false);
  };

  const handleReset = () => {
    onSelect(null);
    setSearchTerm('');
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <input
        type="text"
        className="w-full px-4 py-2 border rounded-md"
        placeholder="Search or select manufacturer..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => setIsOpen(true)}
      />

      {isOpen && (
        <div className="absolute w-full bg-white border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto z-50">
          {filteredManufacturers.length > 0 ? (
            filteredManufacturers.map((manufacturer) => (
              <div
                key={manufacturer}
                className="px-4 py-2 hover:bg-gray-200 cursor-pointer"
                onClick={() => handleSelect(manufacturer)}
              >
                {manufacturer}
              </div>
            ))
          ) : (
            <div className="px-4 py-2 text-gray-500">No matches found</div>
          )}
        </div>
      )}

      {selectedManufacturer && (
        <button
          onClick={handleReset}
          className="mt-2 px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600"
        >
          Reset
        </button>
      )}
    </div>
  );
};

export default ManufacturerSelector;
