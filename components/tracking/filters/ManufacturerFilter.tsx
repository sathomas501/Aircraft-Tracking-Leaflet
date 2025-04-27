import React, { RefObject } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { RegionCode } from '../../../types/base'; // Adjust if necessary

type ManufacturerOption = {
  manufacturer: string;
  count: number;
};

export interface RegionCounts {
  manufacturerCount: number;
  modelCount: number;
  selectedManufacturerCount: number;
  selectedModelCount: number;
  totalActive: number;
}

type ManufacturerFilterProps = {
  selectedManufacturer: string | null;
  handleManufacturerSelect: (value: string) => void;
  activeDropdown: string | null;
  toggleDropdown: (
    dropdown: string,
    event: React.MouseEvent<Element, MouseEvent>
  ) => void;
  dropdownRef: RefObject<HTMLDivElement>;
  manufacturers: ManufacturerOption[];
  combinedLoading: boolean;
  manufacturerSearchTerm: string;
  setManufacturerSearchTerm: (term: string) => void;
  activeRegion: string | RegionCode | null;
  regionCounts: RegionCounts;
  totalActive: number;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onError: (message: string) => void;
};

const ManufacturerFilter: React.FC<ManufacturerFilterProps> = ({
  selectedManufacturer,
  handleManufacturerSelect,
  activeDropdown,
  toggleDropdown,
  dropdownRef,
  manufacturers,
  combinedLoading,
  manufacturerSearchTerm,
  setManufacturerSearchTerm,
}) => {
  const isOpen = activeDropdown === 'manufacturer';

  const filteredManufacturers = manufacturers.filter((m) =>
    m.manufacturer.toLowerCase().includes(manufacturerSearchTerm.toLowerCase())
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => toggleDropdown('manufacturer', e)}
        className={`flex items-center gap-2 h-10 px-3 rounded-md border ${
          selectedManufacturer
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-gray-300'
        } hover:bg-gray-50 transition`}
        data-testid="manufacturer-filter-button"
      >
        <span className="text-sm">
          {selectedManufacturer
            ? `Manufacturer: ${selectedManufacturer}`
            : 'Manufacturer'}
        </span>
        {isOpen ? (
          <ChevronUp size={16} className="text-gray-500" />
        ) : (
          <ChevronDown size={16} className="text-gray-500" />
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg w-64 max-h-96 overflow-y-auto z-10">
          <div className="p-2">
            {/* Search */}
            <div className="relative mb-2">
              <input
                type="text"
                placeholder="Search manufacturers..."
                value={manufacturerSearchTerm}
                onChange={(e) => setManufacturerSearchTerm(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md pl-8"
              />
              <Search
                size={16}
                className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
            </div>

            {/* All Manufacturers */}
            <div
              className={`p-2 cursor-pointer rounded hover:bg-gray-100 ${
                !selectedManufacturer ? 'bg-indigo-50 font-medium' : ''
              }`}
              onClick={() => handleManufacturerSelect('all')}
            >
              All Manufacturers
            </div>

            {/* List */}
            {filteredManufacturers.map((option) => (
              <div
                key={option.manufacturer}
                className={`p-2 cursor-pointer rounded hover:bg-gray-100 flex justify-between items-center ${
                  selectedManufacturer === option.manufacturer
                    ? 'bg-indigo-50 font-medium'
                    : ''
                }`}
                onClick={() => handleManufacturerSelect(option.manufacturer)}
              >
                <span>{option.manufacturer}</span>
                <span className="text-xs text-gray-500">{option.count}</span>
              </div>
            ))}

            {/* Empty states */}
            {filteredManufacturers.length === 0 && !combinedLoading && (
              <div className="p-2 text-gray-500 text-sm">
                No manufacturers found
              </div>
            )}
            {combinedLoading && (
              <div className="p-2 text-gray-500 text-sm">
                Loading manufacturers...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ManufacturerFilter;
