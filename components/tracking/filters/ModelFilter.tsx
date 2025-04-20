import React from 'react';
import type { ModelFilterProps } from '../types/filters';

const ModelFilter: React.FC<ModelFilterProps> = ({
  selectedManufacturer,
  selectedModel,
  totalActive,
  activeDropdown,
  handleModelSelect,
  toggleDropdown,
  dropdownRef,
  activeModels,
}) => {
  const isEnabled = !!selectedManufacturer;

  // Group models by their first letter for the dropdown
  const groupModelsByLetter = () => {
    const groups: Record<string, any[]> = {};

    activeModels.forEach((model) => {
      const firstChar = model.MODEL.charAt(0).toUpperCase();
      if (!groups[firstChar]) {
        groups[firstChar] = [];
      }
      groups[firstChar].push(model);
    });

    // Sort each group alphabetically
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => a.MODEL.localeCompare(b.MODEL));
    });

    return groups;
  };

  // Get most popular models for quick selection
  const getPopularModels = () => {
    return [...activeModels].sort((a, b) => b.count - a.count).slice(0, 8);
  };

  const groupedModels = isEnabled ? groupModelsByLetter() : {};
  const popularModels = isEnabled ? getPopularModels() : [];

  return (
    <div ref={dropdownRef} className="relative">
      <button
        className={`px-4 py-2 flex items-center justify-between gap-2 rounded-lg border ${
          !isEnabled
            ? 'opacity-50 cursor-not-allowed bg-gray-50/30 border-gray-200 text-gray-500'
            : activeDropdown === 'model'
              ? 'bg-indigo-100 text-indigo-700 border-indigo-300 shadow-sm'
              : selectedModel
                ? 'bg-indigo-50/70 text-indigo-600 border-indigo-200'
                : 'bg-gray-50/30 hover:bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
        } transition-all duration-200`}
        onClick={(event) => isEnabled && toggleDropdown('model', event)}
        disabled={!isEnabled}
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
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
          {selectedModel || `Model ${isEnabled ? `(${totalActive})` : ''}`}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 transition-transform ${activeDropdown === 'model' ? 'transform rotate-180' : ''}`}
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

      {isEnabled && activeDropdown === 'model' && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white shadow-lg rounded-md border border-gray-200 z-50">
          <div className="sticky top-0 bg-white border-b">
            <div
              className="px-3 py-2 hover:bg-indigo-50 cursor-pointer font-medium"
              onClick={() => handleModelSelect('')}
            >
              All Models ({totalActive})
              {selectedModel && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleModelSelect('');
                  }}
                  className="float-right text-gray-400 hover:text-gray-600"
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
          </div>

          {/* Popular models section */}
          {popularModels.length > 0 && (
            <div>
              <div className="px-3 py-1 text-xs text-gray-500 bg-gray-50">
                Popular Models
              </div>
              <div className="p-2 flex flex-wrap gap-1">
                {popularModels.map((model) => (
                  <div
                    key={model.MODEL}
                    className={`px-2 py-1 rounded-full text-xs cursor-pointer ${
                      selectedModel === model.MODEL
                        ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                        : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                    }`}
                    onClick={() => handleModelSelect(model.MODEL)}
                  >
                    {model.MODEL} ({model.count})
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alphabetical model listing */}
          <div className="max-h-72 overflow-y-auto">
            {Object.keys(groupedModels)
              .sort()
              .map((letter) => (
                <div key={letter}>
                  <div className="px-3 py-1 text-xs text-gray-500 bg-gray-50 sticky top-0 z-10">
                    {letter}
                  </div>
                  {groupedModels[letter].map((model) => (
                    <div
                      key={model.MODEL}
                      className={`px-3 py-2 hover:bg-indigo-50 cursor-pointer flex justify-between ${
                        selectedModel === model.MODEL
                          ? 'bg-indigo-50 font-medium text-indigo-700'
                          : 'text-gray-700'
                      }`}
                      onClick={() => handleModelSelect(model.MODEL)}
                    >
                      <span>{model.MODEL}</span>
                      <span className="text-gray-500 text-sm">
                        {model.count}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelFilter;
