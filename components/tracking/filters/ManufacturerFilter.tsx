// components/tracking/filters/ManufacturerFilter.tsx
import React, { RefObject } from 'react';
import { ChevronDown, ChevronUp, Search, Building } from 'lucide-react';
import type { ManufacturerFilterProps } from '../types/filters';

const ManufacturerFilter: React.FC<ManufacturerFilterProps> = ({
  manufacturers,
  selectedManufacturer,
  manufacturerSearchTerm,
  setManufacturerSearchTerm,
  selectManufacturerAndClose,
  combinedLoading,
  activeDropdown,
  dropdownRef,
  regionCounts,
  toggleDropdown,
}) => {
  // Filter manufacturers by search term
  const filteredManufacturers = manufacturers.filter((manufacturer) =>
    manufacturer.label
      .toLowerCase()
      .includes(manufacturerSearchTerm.toLowerCase())
  );

  const isOpen = activeDropdown === 'manufacturer';

  return (
    <div ref={dropdownRef} className="relative">
      <button
        className={`px-4 py-2 flex items-center justify-between gap-2 rounded-lg border ${
          isOpen
            ? 'bg-indigo-100 text-indigo-700 border-indigo-300 shadow-sm'
            : selectedManufacturer
              ? 'bg-indigo-50/70 text-indigo-600 border-indigo-200'
              : 'bg-gray-50/30 hover:bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
        } transition-all duration-200`}
        onClick={(event) => toggleDropdown('manufacturer', event)}
        disabled={combinedLoading}
        data-testid="manufacturer-filter-button"
      >
        <span className="flex items-center gap-2 font-medium">
          <Building size={16} className="text-current" />
          {selectedManufacturer
            ? manufacturers.find((m) => m.value === selectedManufacturer)
                ?.label || selectedManufacturer
            : 'Manufacturer'}
        </span>
        {isOpen ? (
          <ChevronUp size={16} className="text-gray-500" />
        ) : (
          <ChevronDown size={16} className="text-gray-500" />
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white shadow-lg rounded-md border border-gray-200 z-50">
          <div className="sticky top-0 bg-white p-2 border-b">
            <div className="relative">
              <input
                type="text"
                className="w-full px-3 py-2 pl-8 border border-gray-300 rounded-md"
                placeholder="Search manufacturers..."
                value={manufacturerSearchTerm}
                onChange={(e) => setManufacturerSearchTerm(e.target.value)}
                autoFocus
              />
              <Search
                size={16}
                className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400"
              />

              {selectedManufacturer && (
                <button
                  onClick={() => selectManufacturerAndClose('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {combinedLoading ? (
              <div className="p-3 text-center text-gray-500">
                Loading manufacturers...
              </div>
            ) : filteredManufacturers.length === 0 ? (
              <div className="p-3 text-center text-gray-500">
                No results found
              </div>
            ) : (
              filteredManufacturers.map((manufacturer) => (
                <div
                  key={manufacturer.value}
                  className={`px-3 py-2 hover:bg-indigo-50 cursor-pointer ${
                    selectedManufacturer === manufacturer.value
                      ? 'bg-indigo-50 font-medium text-indigo-700'
                      : 'text-gray-700'
                  }`}
                  onClick={() => selectManufacturerAndClose(manufacturer.value)}
                >
                  {manufacturer.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ManufacturerFilter;
