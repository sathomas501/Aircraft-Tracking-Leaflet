// components/tracking/filters/RibbonGeofenceWrapper.tsx
import React from 'react';
import { GeofenceFilterContainer } from './index';

interface RibbonGeofenceWrapperProps {
  activeDropdown: string | null;
  setActiveDropdown: (dropdown: string | null) => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
}

const RibbonGeofenceWrapper: React.FC<RibbonGeofenceWrapperProps> = ({
  activeDropdown,
  setActiveDropdown,
  dropdownRef,
}) => {
  // Determine if this dropdown is active
  const isActive = activeDropdown === 'location';

  // Handle dropdown toggle
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveDropdown(isActive ? null : 'location');
  };

  return (
    <div className="relative">
      {/* Toggle button */}
      <button
        onClick={handleToggle}
        className={`flex items-center h-12 px-3 text-sm border-b-2 ${
          isActive
            ? 'text-indigo-600 border-indigo-600'
            : 'text-gray-700 border-transparent hover:text-indigo-600'
        }`}
        title="Filter by location"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 mr-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        Location
      </button>

      {/* Dropdown container */}
      {isActive && (
        <div className="absolute top-full left-0 z-50 w-72 bg-white rounded-md shadow-lg border border-gray-200 overflow-hidden">
          <GeofenceFilterContainer
            onClose={() => setActiveDropdown(null)}
            dropdownRef={dropdownRef}
          />
        </div>
      )}
    </div>
  );
};

export default RibbonGeofenceWrapper;
