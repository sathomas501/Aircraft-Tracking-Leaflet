import { SelectOption, Aircraft } from '@/types/base';
import { useState, useMemo, useRef, useEffect } from 'react';

interface Model {
  model: string;
  label: string;
  activeCount?: number; // `activeCount` is optional (number | undefined)
}

interface ManufacturerSelectorProps {
  manufacturers: SelectOption[];
  selectedManufacturer: string | null;
  setSelectedManufacturer: (manufacturer: string | null) => void;
  onSelect: (manufacturer: string | null) => Promise<void>;
  onAircraftUpdate: (aircraft: Aircraft[]) => void;
  onModelsUpdate: (models: Model[]) => void;
  onError: (message: string) => void;
}

const ManufacturerSelector: React.FC<ManufacturerSelectorProps> = ({
  manufacturers,
  selectedManufacturer,
  setSelectedManufacturer,
  onSelect,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Memoized manufacturer filtering
  const filteredManufacturers = useMemo(() => {
    if (!searchTerm) {
      return manufacturers;
    }
    const searchTermLower = searchTerm.toLowerCase();
    return manufacturers.filter((manufacturer) =>
      manufacturer.label.toLowerCase().includes(searchTermLower)
    );
  }, [manufacturers, searchTerm]);

  // Click outside handler to close dropdown
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

  // Handle manufacturer selection
  const handleSelect = async (manufacturer: string | null) => {
    console.log('[ManufacturerSelector] 🔍 Selection initiated:', manufacturer);
    setIsOpen(false);
    if (manufacturer) {
      const selectedLabel =
        manufacturers.find((m) => m.value === manufacturer)?.label || '';
      console.log(
        '[ManufacturerSelector] ✅ Found manufacturer:',
        selectedLabel
      );
      setSearchTerm(selectedLabel);
      setSelectedManufacturer(manufacturer);
    } else {
      console.log('[ManufacturerSelector] 🔄 Resetting selection');
      setSearchTerm('');
      setSelectedManufacturer(null);
    }
    await onSelect(manufacturer);
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

      {isOpen && manufacturers.length > 0 && (
        <div className="absolute w-full bg-white border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto z-50">
          {filteredManufacturers.length > 0 ? (
            filteredManufacturers.map((manufacturer) => (
              <div
                key={manufacturer.value}
                className="px-4 py-2 hover:bg-gray-200 cursor-pointer"
                onClick={() => handleSelect(manufacturer.value)}
              >
                {manufacturer.label}
                {manufacturer.activeCount
                  ? ` (${manufacturer.activeCount} active)`
                  : ''}
              </div>
            ))
          ) : (
            <div className="px-4 py-2 text-gray-500">No matches found</div>
          )}
        </div>
      )}

      {selectedManufacturer && (
        <button
          onClick={() => handleSelect(null)}
          className="mt-2 px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600"
        >
          Reset
        </button>
      )}
    </div>
  );
};

export default ManufacturerSelector;
