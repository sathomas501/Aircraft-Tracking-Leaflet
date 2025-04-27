// components/common/FilterDropdown.tsx
import React, { useRef, useEffect } from 'react';
import { useFilterLogic } from '../tracking/hooks/useFilterLogic';

interface FilterDropdownProps {
  id: string;
  label: React.ReactNode;
  icon: React.ReactNode;
  isFiltered: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({
  id,
  label,
  icon,
  isFiltered,
  disabled = false,
  children,
}) => {
  const { activeDropdown, toggleDropdown } = useFilterLogic();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        // Close the dropdown if it's open
        if (activeDropdown === id) {
          toggleDropdown(id, event as unknown as React.MouseEvent);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeDropdown, id, toggleDropdown]);

  const handleToggle = (event: React.MouseEvent) => {
    if (!disabled) {
      toggleDropdown(id, event);
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        className={`px-4 py-2 flex items-center justify-between gap-2 rounded-lg border ${
          disabled
            ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed'
            : activeDropdown === id
              ? 'bg-indigo-100 text-indigo-700 border-indigo-300 shadow-sm'
              : isFiltered
                ? 'bg-indigo-50/70 text-indigo-600 border-indigo-200'
                : 'bg-gray-50/30 hover:bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
        } transition-all duration-200`}
        onClick={handleToggle}
        disabled={disabled}
      >
        <span className="flex items-center gap-2 font-medium">
          {React.cloneElement(icon as React.ReactElement, {
            className: disabled
              ? 'text-gray-400'
              : isFiltered
                ? 'text-indigo-500'
                : 'text-gray-500',
          })}
          {label}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 transition-transform ${activeDropdown === id ? 'transform rotate-180' : ''}`}
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

      {activeDropdown === id && !disabled && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white shadow-lg rounded-md border border-gray-200 z-50">
          {children}
        </div>
      )}
    </div>
  );
};

export default FilterDropdown;
