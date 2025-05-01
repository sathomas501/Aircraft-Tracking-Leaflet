import React from 'react';
import type { ManufacturerFilterProps } from '../types/filters.ts';
import ManufacturerFilterContainer from '../filters/Containers/ManufacturerFilterContainer.js';

const ManufacturerFilter: React.FC<ManufacturerFilterProps> = ({
  manufacturers,
  selectedManufacturer,
  manufacturerSearchTerm,
  setManufacturerSearchTerm,
  selectManufacturerAndClose,
  combinedLoading,
  activeDropdown,
  dropdownRef,
  fetchModelsForManufacturer,
  applyAllFilters,
  toggleDropdown,
}) => {
  // Filter manufacturers by search term
  const filteredManufacturers = manufacturers.filter((manufacturer) =>
    manufacturer.label
      .toLowerCase()
      .includes(manufacturerSearchTerm.toLowerCase())
  );

  return (
    <div ref={dropdownRef} className="relative">
      <button
        className={`px-4 py-2 flex items-center justify-between gap-2 rounded-lg border ${
          activeDropdown === 'manufacturer'
            ? 'bg-indigo-100 text-indigo-700 border-indigo-300 shadow-sm'
            : selectedManufacturer
              ? 'bg-indigo-50/70 text-indigo-600 border-indigo-200'
              : 'bg-gray-50/30 hover:bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
        } transition-all duration-200`}
        onClick={(event) => toggleDropdown('manufacturer', event)}
        disabled={combinedLoading}
      >
        <span className="flex items-center gap-2 font-medium">
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
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          {selectedManufacturer
            ? manufacturers.find((m) => m.value === selectedManufacturer)
                ?.label || selectedManufacturer
            : 'Manufacturer'}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 transition-transform ${activeDropdown === 'manufacturer' ? 'transform rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {activeDropdown === 'manufacturer' && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white shadow-lg rounded-md border border-gray-200 z-50">
          <div className="sticky top-0 bg-white p-2 border-b">
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Search manufacturers..."
              value={manufacturerSearchTerm}
              onChange={(e) => setManufacturerSearchTerm(e.target.value)}
              autoFocus
            />

            {selectedManufacturer && (
              <button
                onClick={() => {}}
                className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
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

          <div className="max-h-72 overflow-y-auto">
            {filteredManufacturers.length === 0 ? (
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
                  onClick={() => {
                    selectManufacturerAndClose(manufacturer.value); // selects and closes
                    fetchModelsForManufacturer(manufacturer.value); // triggers model fetch
                    setTimeout(() => applyAllFilters(), 0); // optional: trigger full filter logic
                  }}
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
