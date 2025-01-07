import React, { useState, useEffect, useRef, useCallback } from 'react';
import debounce from 'lodash/debounce';
import { fetchOpenskyPositions, fetchOpenskyManufacturers } from 'lib/opensky-client';

interface ManufacturerOption {
  label: string;
  value: string;
  count: number; // Must always be a number
}

interface CompactManufacturerSelectorProps {
  onManufacturerSelect: (manufacturer: string) => void;
}

const CompactManufacturerSelector: React.FC<CompactManufacturerSelectorProps> = ({
  onManufacturerSelect,
}) => {
  const [manufacturers, setManufacturers] = useState<ManufacturerOption[]>([]);
  const [filteredManufacturers, setFilteredManufacturers] = useState<ManufacturerOption[]>([]);
  const [manufacturerInput, setManufacturerInput] = useState('');
  const [selectedManufacturer, setSelectedManufacturer] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const manufacturerInputRef = useRef<HTMLInputElement>(null);

  // Fetch manufacturers
  useEffect(() => {
    const fetchManufacturers = async () => {
      setIsLoading(true);
      try {
        const result = await fetchOpenskyManufacturers();
        const options = result.map((manufacturer: any) => ({
          label: manufacturer.name,
          value: manufacturer.id,
          count: manufacturer.count || 0, // Ensure count is a number
        }));
        setManufacturers(options);
        setFilteredManufacturers(options);
      } catch (error) {
        console.error('Failed to fetch manufacturers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchManufacturers();
  }, []);

  // Debounced search filtering
  const debouncedFilter = useCallback(
    debounce((searchTerm: string, options: ManufacturerOption[]) => {
      const filtered = !searchTerm
        ? options
        : options.filter((option) =>
            option.label.toLowerCase().includes(searchTerm.toLowerCase())
          );
      setFilteredManufacturers(filtered);
    }, 300),
    []
  );

  useEffect(() => {
    debouncedFilter(manufacturerInput, manufacturers);
    return () => debouncedFilter.cancel();
  }, [manufacturerInput, manufacturers]);

  const handleSelectManufacturer = (manufacturer: ManufacturerOption) => {
    setSelectedManufacturer(manufacturer.value);
    setManufacturerInput(manufacturer.label);
    onManufacturerSelect(manufacturer.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        setHighlightedIndex((prev) =>
          prev < filteredManufacturers.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        if (highlightedIndex >= 0 && filteredManufacturers[highlightedIndex]) {
          handleSelectManufacturer(filteredManufacturers[highlightedIndex]);
        }
        break;
      case 'Escape':
        setHighlightedIndex(-1);
        break;
      default:
        break;
    }
  };

  return (
    <div className="compact-manufacturer-selector">
      <input
        type="text"
        ref={manufacturerInputRef}
        value={manufacturerInput}
        onChange={(e) => setManufacturerInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search manufacturers"
        className="input-field"
      />
      {isLoading && <p>Loading...</p>}
      {!isLoading && (
        <ul className="manufacturer-list">
          {filteredManufacturers.map((manufacturer, index) => (
            <li
              key={manufacturer.value}
              onClick={() => handleSelectManufacturer(manufacturer)}
              className={highlightedIndex === index ? 'highlighted' : ''}
            >
              {manufacturer.label} ({manufacturer.count})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CompactManufacturerSelector;
