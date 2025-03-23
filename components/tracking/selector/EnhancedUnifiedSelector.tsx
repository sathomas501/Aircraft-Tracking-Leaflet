import React, { useState, useEffect, useRef } from 'react';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import type { SelectOption } from '@/types/base';
import type { AircraftModel } from '../../../types/aircraft-models';

interface EnhancedUnifiedSelectorProps {
  manufacturers: SelectOption[];
}

const EnhancedUnifiedSelector: React.FC<EnhancedUnifiedSelectorProps> = ({
  manufacturers,
}) => {
  // Context state and actions
  const {
    selectedManufacturer,
    selectedModel,
    activeModels,
    isLoading,
    totalActive,
    selectManufacturer,
    selectModel,
    reset,
    fullRefresh,
  } = useEnhancedMapContext();

  // UI state
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isManufacturerMenuOpen, setIsManufacturerMenuOpen] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);

  // Drag state
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const manufacturerMenuRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter manufacturers by search term
  const filteredManufacturers = manufacturers.filter((manufacturer) =>
    manufacturer.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Update compact mode based on manufacturer selection
  useEffect(() => {
    setIsCompact(!!selectedManufacturer);
  }, [selectedManufacturer]);

  // Handle dropdown visibility with a delay to ensure proper rendering
  useEffect(() => {
    if (isManufacturerMenuOpen) {
      // Short delay to ensure DOM is ready
      setTimeout(() => {
        setDropdownVisible(true);
        // Focus the search input if available
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
    } else {
      setDropdownVisible(false);
    }
  }, [isManufacturerMenuOpen]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        manufacturerMenuRef.current &&
        !manufacturerMenuRef.current.contains(event.target as Node) &&
        dropdownButtonRef.current &&
        !dropdownButtonRef.current.contains(event.target as Node)
      ) {
        setIsManufacturerMenuOpen(false);
      }

      if (
        modelMenuRef.current &&
        !modelMenuRef.current.contains(event.target as Node)
      ) {
        setIsModelMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Dragging functionality
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: Math.max(0, e.clientX - dragOffset.x),
          y: Math.max(0, e.clientY - dragOffset.y),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'grabbing';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
  }, [isDragging, dragOffset]);

  // Start dragging
  const startDragging = (e: React.MouseEvent) => {
    if (
      e.target === containerRef.current ||
      (e.target as HTMLElement).closest('.drag-handle')
    ) {
      e.preventDefault();
      setIsDragging(true);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    }
  };

  // Group models alphabetically for easier selection
  const groupedModels = activeModels.reduce(
    (groups: Record<string, AircraftModel[]>, model) => {
      const firstChar = model.model.charAt(0).toUpperCase();
      if (!groups[firstChar]) {
        groups[firstChar] = [];
      }
      groups[firstChar].push(model);
      return groups;
    },
    {}
  );

  // Handler functions
  const selectManufacturerAndClose = (value: string) => {
    selectManufacturer(value === '' ? null : value);
    setIsManufacturerMenuOpen(false);
    setSearchTerm('');
  };

  const handleModelSelect = (value: string) => {
    selectModel(value === '' ? null : value);
    setIsModelMenuOpen(false);
  };

  const getManufacturerLabel = () => {
    const found = manufacturers.find((m) => m.value === selectedManufacturer);
    return found ? found.label : 'Select Manufacturer';
  };

  // Get currently active models for the model tag display
  const modelsByPopularity = [...activeModels]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 1000,
      }}
      className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-visible w-80 transition-all duration-300 select-none"
    >
      {/* Header */}
      <div
        className="bg-indigo-600 text-white px-4 py-3 flex justify-between items-center cursor-grab drag-handle"
        onMouseDown={startDragging}
      >
        <h2 className="font-semibold flex items-center space-x-2">
          {selectedManufacturer ? (
            <span className="truncate max-w-44">{getManufacturerLabel()}</span>
          ) : (
            <span className="flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
              Aircraft Selector
            </span>
          )}
        </h2>

        <div className="flex items-center space-x-1">
          {selectedManufacturer && (
            <button
              onClick={() => reset()}
              className="text-white text-xs bg-indigo-700 hover:bg-indigo-800 p-1 rounded"
              title="Reset selection"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-indigo-500 rounded transition-colors"
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Content area - only shown when not collapsed */}
      {!isCollapsed && (
        <div className="transition-all duration-300">
          {!selectedManufacturer ? (
            /* Manufacturer Selection View */
            <div className="p-4">
              <div className="mb-4">
                <div className="mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    Select Manufacturer
                  </label>
                </div>

                {/* Manufacturer Dropdown - Enhanced */}
                <div className="relative" ref={manufacturerMenuRef}>
                  <button
                    ref={dropdownButtonRef}
                    className={`w-full flex items-center justify-between px-3 py-2 border ${
                      isManufacturerMenuOpen
                        ? 'border-indigo-500 ring-1 ring-indigo-300'
                        : 'border-gray-300 hover:border-gray-400'
                    } rounded-md bg-white transition-colors`}
                    onClick={() =>
                      setIsManufacturerMenuOpen(!isManufacturerMenuOpen)
                    }
                  >
                    {selectedManufacturer ? (
                      <span className="text-indigo-700 font-medium truncate">
                        {getManufacturerLabel()}
                      </span>
                    ) : (
                      <span className="text-gray-500 truncate">
                        Select manufacturer...
                      </span>
                    )}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={`h-4 w-4 text-gray-500 transition-transform ${
                        isManufacturerMenuOpen ? 'transform rotate-180' : ''
                      }`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>

                  {!selectedManufacturer && !isManufacturerMenuOpen && (
                    <div className="mt-1 text-xs text-gray-500 flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3 mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Click to see all {manufacturers.length} available
                      manufacturers
                    </div>
                  )}

                  {/* Manufacturer Menu - Fixed Implementation */}
                  {isManufacturerMenuOpen && (
                    <div
                      className="fixed z-50 border border-gray-200 rounded-md shadow-lg bg-white"
                      style={{
                        width: manufacturerMenuRef.current?.offsetWidth || 300,
                        top: dropdownButtonRef.current
                          ? dropdownButtonRef.current.getBoundingClientRect()
                              .bottom + 5
                          : 'auto',
                        left: dropdownButtonRef.current
                          ? dropdownButtonRef.current.getBoundingClientRect()
                              .left
                          : 'auto',
                        maxHeight: '60vh',
                        display: dropdownVisible ? 'block' : 'none',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Search input */}
                      <div className="sticky top-0 bg-white p-2 border-b z-10">
                        <div className="relative">
                          <input
                            ref={searchInputRef}
                            type="text"
                            className="w-full pl-8 pr-2 py-2 border border-gray-300 rounded-md"
                            placeholder="Search manufacturers..."
                            value={searchTerm}
                            onChange={(e) => {
                              setSearchTerm(e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 absolute left-3 top-3 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                          </svg>
                        </div>
                        <div className="mt-1 text-xs text-gray-500 flex items-center">
                          Showing {filteredManufacturers.length} of{' '}
                          {manufacturers.length} manufacturers
                        </div>
                      </div>

                      {/* Manufacturer List */}
                      <div
                        className="overflow-y-auto"
                        style={{ maxHeight: 'calc(60vh - 70px)' }}
                      >
                        {searchTerm !== '' && (
                          <div className="px-3 py-1 text-xs text-gray-500 bg-gray-50 sticky top-0 z-10">
                            {filteredManufacturers.length} results
                          </div>
                        )}

                        {filteredManufacturers.length === 0 ? (
                          <div className="px-3 py-4 text-center text-gray-500 flex flex-col items-center">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5 mb-1"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                              />
                            </svg>
                            No matches found
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
                              onClick={() =>
                                selectManufacturerAndClose(manufacturer.value)
                              }
                            >
                              {manufacturer.label}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Help Text */}
              <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-md">
                <p className="flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-2 text-indigo-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Select a manufacturer to view available aircraft models
                </p>
              </div>
            </div>
          ) : (
            /* Model Selection View - After Manufacturer is selected */
            <div className="p-4">
              {/* Model selector */}
              <div className="mb-3">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    Aircraft Model
                  </label>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => selectModel(null)}
                      className={`text-xs ${
                        selectedModel
                          ? 'text-indigo-600 hover:text-indigo-800 hover:underline'
                          : 'text-gray-400 cursor-not-allowed'
                      }`}
                      disabled={!selectedModel}
                    >
                      Clear
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => reset()}
                      className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      Change Manufacturer
                    </button>
                  </div>
                </div>

                {/* Model Dropdown - Fixed Version */}
                <div className="relative" ref={modelMenuRef}>
                  <button
                    className={`w-full flex items-center justify-between px-3 py-2 border ${
                      isModelMenuOpen
                        ? 'border-indigo-500 ring-1 ring-indigo-300'
                        : 'border-gray-300 hover:border-gray-400'
                    } rounded-md bg-white transition-colors`}
                    onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                  >
                    <span className="text-gray-700 truncate">
                      {selectedModel || `All Models (${totalActive})`}
                    </span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={`h-4 w-4 text-gray-500 transition-transform ${
                        isModelMenuOpen ? 'transform rotate-180' : ''
                      }`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>

                  {/* Model Menu */}
                  {isModelMenuOpen && (
                    <div
                      className="absolute z-20 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 overflow-y-auto"
                      style={{
                        maxHeight: '400px',
                      }}
                    >
                      <div className="sticky top-0 bg-white border-b z-10">
                        <div
                          className="px-3 py-2 hover:bg-indigo-50 cursor-pointer font-medium"
                          onClick={() => handleModelSelect('')}
                        >
                          All Models ({totalActive})
                        </div>
                      </div>

                      {/* Alphabetically grouped models */}
                      {Object.entries(groupedModels)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([letter, models]) => (
                          <div key={letter}>
                            <div className="px-3 py-1 text-xs text-gray-500 bg-gray-50 sticky top-10 z-10">
                              {letter}
                            </div>
                            {models
                              .sort((a, b) => a.model.localeCompare(b.model))
                              .map((model) => (
                                <div
                                  key={model.model}
                                  className={`px-3 py-2 hover:bg-indigo-50 cursor-pointer flex justify-between ${
                                    selectedModel === model.model
                                      ? 'bg-indigo-50 font-medium text-indigo-700'
                                      : 'text-gray-700'
                                  }`}
                                  onClick={() => handleModelSelect(model.model)}
                                >
                                  <span>{model.model}</span>
                                  <span className="text-gray-500 text-sm">
                                    {model.count}
                                  </span>
                                </div>
                              ))}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Active Aircraft Info */}
              <div className="mt-4 bg-gray-50 p-3 rounded-md">
                <div className="text-sm">
                  <div className="flex items-center text-indigo-700 font-medium mb-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 mr-1"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                    {selectedModel ? (
                      <span>
                        Tracking{' '}
                        {activeModels.find((m) => m.model === selectedModel)
                          ?.count || 0}{' '}
                        aircraft
                      </span>
                    ) : (
                      <div className="flex flex-col">
                        <span>
                          Tracking {totalActive} aircraft across{' '}
                          {activeModels.length} models
                        </span>

                        {/* Status messages - show only one */}
                        {isLoading ? (
                          <span className="text-xs text-indigo-600 mt-1 flex items-center">
                            <svg
                              className="animate-spin h-3 w-3 mr-1"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            Loading aircraft data...
                          </span>
                        ) : totalActive === 0 ? (
                          <span className="text-xs text-gray-600 mt-1">
                            No aircraft currently being tracked. Try refreshing
                            data or selecting a different manufacturer.
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {/* Top models by popularity */}
                  <div className="flex flex-wrap gap-1 mt-1 max-h-24 overflow-y-auto">
                    {modelsByPopularity.map((model) => (
                      <div
                        key={model.model}
                        className={`px-2 py-1 rounded-full text-xs cursor-pointer ${
                          selectedModel === model.model
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                            : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                        }`}
                        onClick={() => selectModel(model.model)}
                        title={`Select ${model.model}`}
                      >
                        {model.model} ({model.count})
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex mt-4">
                <button
                  onClick={() => fullRefresh()}
                  disabled={isLoading}
                  className={`w-full px-3 py-2 rounded-md text-sm font-medium flex items-center justify-center ${
                    isLoading
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {isLoading ? (
                    <span className="flex items-center">
                      <svg
                        className="animate-spin h-4 w-4 mr-2"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Refreshing data...
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 mr-2"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Refresh Aircraft Data
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedUnifiedSelector;
