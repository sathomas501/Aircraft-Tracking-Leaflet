// components/tracking/filters/ModelFilter.tsx
import React, { RefObject } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { RegionCode } from '../../../types/base'; // adjust path if needed
import { ModelFilterProps, ModelOption } from '../types/filters';

const ModelFilter: React.FC<ModelFilterProps> = ({
  selectedModel,
  handleModelSelect,
  activeDropdown,
  toggleDropdown,
  dropdownRef,
  modelOptions,
  activeRegion,
  regionCounts,
}) => {
  const isOpen = activeDropdown === 'model';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => toggleDropdown('model', e)}
        className={`flex items-center gap-2 h-10 px-3 rounded-md border ${
          selectedModel ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'
        } hover:bg-gray-50 transition`}
        data-testid="model-filter-button"
      >
        <span className="text-sm">
          {selectedModel ? `Model: ${selectedModel}` : 'Model'}
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
            <div
              className={`p-2 cursor-pointer rounded hover:bg-gray-100 ${
                !selectedModel ? 'bg-indigo-50 font-medium' : ''
              }`}
              onClick={() => handleModelSelect('')}
            >
              All Models
            </div>

            {modelOptions &&
              modelOptions.map((option) => (
                <div
                  key={option.name}
                  className={`p-2 cursor-pointer rounded hover:bg-gray-100 flex justify-between items-center ${
                    selectedModel === option.name
                      ? 'bg-indigo-50 font-medium'
                      : ''
                  }`}
                  onClick={() => handleModelSelect(option.name)}
                >
                  <span>{option.name}</span>
                  <span className="text-xs text-gray-500">{option.count}</span>
                </div>
              ))}

            {(!modelOptions || modelOptions.length === 0) && (
              <div className="p-2 text-gray-500 text-sm">
                No models available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelFilter;
