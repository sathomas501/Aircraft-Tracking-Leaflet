import React from 'react';

interface RibbonClearFiltersButtonProps {
  onClear?: () => void;
}

export const RibbonClearFiltersButton: React.FC<
  RibbonClearFiltersButtonProps
> = ({ onClear }) => {
  return (
    <button
      onClick={onClear}
      className="px-3 py-1.5 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors flex items-center gap-1 text-sm"
      title="Clear all filters"
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
      Clear All
    </button>
  );
};
