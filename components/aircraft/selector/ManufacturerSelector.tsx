import { SelectOption, Aircraft } from '@/types/base';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useAircraftData } from '../customHooks/useAircraftData';
import { Model } from '../../../types/base';

interface ManufacturerSelectorProps {
  manufacturers: SelectOption[];
  selectedManufacturer: string | null;
  setSelectedManufacturer: (manufacturer: string | null) => void;
  onSelect: (manufacturer: string | null) => Promise<Aircraft[]>;
  onAircraftUpdate: (aircraft: Aircraft[]) => void;
  onModelsUpdate?: (models: Model[]) => void; // ✅ Add this property
  onError: (message: string) => void;
}

const ManufacturerSelector: React.FC<ManufacturerSelectorProps> = ({
  manufacturers,
  selectedManufacturer,
  setSelectedManufacturer,
  onSelect,
  onAircraftUpdate, // ✅ Ensure this prop is destructured
  onError, // ✅ Ensure this prop is destructured
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

      try {
        const aircraftData = await onSelect(manufacturer); // ✅ Fetch aircraft safely
        console.log('[ManufacturerSelector] ✈️ Static aircraft:', aircraftData);

        if (aircraftData.length > 0) {
          onAircraftUpdate(aircraftData); // ✅ Update UI with aircraft data
        } else {
          console.warn('[ManufacturerSelector] ⚠️ No active aircraft found.');
          onAircraftUpdate([]); // ✅ Prevent undefined errors
        }
      } catch (error) {
        console.error(
          '[ManufacturerSelector] ❌ Error fetching aircraft:',
          error
        );
        onError?.('Failed to fetch aircraft data.');
      }
    } else {
      console.log('[ManufacturerSelector] 🔄 Resetting selection');
      setSearchTerm('');
      setSelectedManufacturer(null);
      onAircraftUpdate([]); // ✅ Clear aircraft data when resetting
    }
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
