// components/ui/Select/PaginatedSelect.tsx
import React, { useState, useEffect, useMemo } from 'react';
import type { SelectOption } from '@/types/base';

interface PaginatedSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  pageSize?: number;
}

export function PaginatedSelect({
  options,
  value,
  onChange,
  label,
  placeholder = 'Select option',
  disabled = false,
  loading = false,
  error,
  pageSize = 50
}: PaginatedSelectProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  // Reset page when search changes
  useEffect(() => {
    setPage(0);
  }, [search]);

  const filteredOptions = useMemo(() => {
    return options.filter(option => 
      option.label.toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search]);

  const totalPages = Math.ceil(filteredOptions.length / pageSize);
  const displayedOptions = filteredOptions.slice(
    page * pageSize,
    (page + 1) * pageSize
  );

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      
      {/* Search input */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search..."
        className="w-full p-2 border rounded mb-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        disabled={disabled || loading}
      />

      {/* Select dropdown */}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading}
        className="w-full p-2 border rounded shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
      >
        <option value="">{loading ? 'Loading...' : placeholder}</option>
        {displayedOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label} ({option.count || 0})
          </option>
        ))}
      </select>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-2 text-sm">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500 mt-1">{error}</p>
      )}

      <div className="text-sm text-gray-500 mt-1">
        Showing {displayedOptions.length} of {filteredOptions.length} options
      </div>
    </div>
  );
}