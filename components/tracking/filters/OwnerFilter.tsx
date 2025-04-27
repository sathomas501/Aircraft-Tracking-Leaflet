// components/tracking/filters/OwnerFilter.tsx
import React, { RefObject } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { FilterMode } from '../types/filters'; // adjust if your FilterMode type is somewhere else

type OwnerFilterProps = {
  activeFilters: string[];
  onFilterChange: (filters: string[]) => void;
  allOwnerTypes: string[];
  activeDropdown: string | null;
  toggleFilterMode: (mode: FilterMode) => void;
  dropdownRef: RefObject<HTMLDivElement>;
  toggleDropdown: (
    dropdown: string,
    event: React.MouseEvent<Element, MouseEvent>
  ) => void;
};

const OwnerFilter: React.FC<OwnerFilterProps> = ({
  activeFilters,
  onFilterChange,
  allOwnerTypes,
  activeDropdown,
  toggleFilterMode,
  dropdownRef,
  toggleDropdown,
}) => {
  const isOpen = activeDropdown === 'owner';

  const handleToggleFilter = (ownerType: string) => {
    if (activeFilters.includes(ownerType)) {
      onFilterChange(activeFilters.filter((f) => f !== ownerType));
    } else {
      onFilterChange([...activeFilters, ownerType]);
    }
  };

  const handleClearFilters = () => {
    onFilterChange([]);
  };

  const handleSelectAll = () => {
    onFilterChange([...allOwnerTypes]);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => toggleDropdown('owner', e)}
        className={`flex items-center gap-2 h-10 px-3 rounded-md border ${
          activeFilters.length > 0
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-gray-300'
        } hover:bg-gray-50 transition`}
        data-testid="owner-filter-button"
      >
        <span className="text-sm">
          {activeFilters.length > 0
            ? `Owner Types (${activeFilters.length})`
            : 'Owner Types'}
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
            {/* Filter mode selector */}
            <div className="flex mb-2 bg-gray-100 rounded overflow-hidden">
              <button
                className={`flex-1 py-1 text-sm ${
                  activeFilters.length === 0
                    ? 'bg-indigo-500 text-white'
                    : 'text-gray-700'
                }`}
                onClick={handleClearFilters}
              >
                None
              </button>
              <button
                className={`flex-1 py-1 text-sm ${
                  activeFilters.length > 0 &&
                  activeFilters.length < allOwnerTypes.length
                    ? 'bg-indigo-500 text-white'
                    : 'text-gray-700'
                }`}
                onClick={() => toggleFilterMode('AND')}
              >
                Some
              </button>
              <button
                className={`flex-1 py-1 text-sm ${
                  activeFilters.length === allOwnerTypes.length
                    ? 'bg-indigo-500 text-white'
                    : 'text-gray-700'
                }`}
                onClick={handleSelectAll}
              >
                All
              </button>
            </div>

            {/* Owner type checkboxes */}
            {allOwnerTypes.map((ownerType) => (
              <div
                key={ownerType}
                className="flex items-center p-2 hover:bg-gray-50 cursor-pointer"
                onClick={() => handleToggleFilter(ownerType)}
              >
                <input
                  type="checkbox"
                  checked={activeFilters.includes(ownerType)}
                  readOnly
                  className="mr-2"
                />
                <span className="text-sm">{ownerType}</span>
              </div>
            ))}

            {allOwnerTypes.length === 0 && (
              <div className="p-2 text-gray-500 text-sm">
                No owner types available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerFilter;
