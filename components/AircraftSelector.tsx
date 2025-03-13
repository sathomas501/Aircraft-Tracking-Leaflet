import React, { useState, useRef, useEffect } from 'react';
import { Minus, Plus, RefreshCw } from 'lucide-react';
import { useAircraft } from '../hooks/useAircraft';
import { Aircraft, SelectOption } from '@/types/base';
import { AircraftModel } from '@/types/aircraft-models';

interface AircraftSelectorProps {
  // Basic props
  initialManufacturer?: string | null;
  initialModel?: string | null;
  onAircraftChange?: (aircraft: Aircraft[]) => void;
  onStatusChange?: (status: string) => void;
  onError?: (error: string) => void;
  autoPolling?: boolean; // Whether to use automatic polling
  pollInterval?: number; // Optional custom poll interval
  
  // Optional data override props for using with existing data sources
  externalManufacturers?: SelectOption[];
  externalModels?: AircraftModel[];
  externalAircraft?: Aircraft[];
  onManufacturerSelect?: (manufacturer: string | null) => void;
  onModelSelect?: (model: string | null) => void;
}

const AircraftSelector: React.FC<AircraftSelectorProps> = ({
  initialManufacturer = null,
  initialModel = null,
  onAircraftChange,
  onStatusChange,
  onError,
  autoPolling = false,
  pollInterval,
  externalManufacturers,
  externalModels,
  externalAircraft,
  onManufacturerSelect,
  onModelSelect
}) => {
  // UI state
  const [isMinimized, setIsMinimized] = useState(false);
  const [isManufacturerDropdownOpen, setIsManufacturerDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Refs
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Use our unified aircraft hook
  const {
    // Data
    manufacturers: hookManufacturers,
    models: hookModels,
    aircraft: hookAircraft,
    selectedManufacturer: hookSelectedManufacturer,
    selectedModel: hookSelectedModel,
    
    // UI state
    isLoading: hookIsLoading,
    statusMessage: hookStatusMessage,
    error: hookError,
    lastRefreshed: hookLastRefreshed,
    
    // Actions
    selectManufacturer: hookSelectManufacturer,
    selectModel: hookSelectModel,
    reset: hookReset,
    refreshManufacturers: hookRefreshManufacturers,
    refreshAircraft: hookRefreshAircraft,
    
    // Stats
    totalActiveAircraft: hookTotalActiveAircraft,
    totalFilteredAircraft: hookTotalFilteredAircraft,
    totalActiveModels: hookTotalActiveModels
  } = useAircraft({
    initialManufacturer,
    initialModel,
    onStatusChange,
    onError,
    autoPolling,
    pollInterval
  });
  
  // Determine which data sources to use (external props or hook data)
  const manufacturers = externalManufacturers || hookManufacturers;
  const models = externalModels || hookModels;
  const aircraft = externalAircraft || hookAircraft;
  const selectedManufacturer = onManufacturerSelect ? initialManufacturer : hookSelectedManufacturer;
  const selectedModel = onModelSelect ? initialModel : hookSelectedModel;
  const isLoading = hookIsLoading || isRefreshing;
  const statusMessage = hookStatusMessage;
  const error = hookError;
  const lastRefreshed = hookLastRefreshed;
  
  // Compute stats based on the actual data we're using
  const totalActiveAircraft = externalAircraft?.length || hookTotalActiveAircraft;
  const totalFilteredAircraft = externalAircraft?.length || hookTotalFilteredAircraft;
  const totalActiveModels = models.filter(m => (m.activeCount || 0) > 0).length;
  const totalModels = models.length;
  
  // Notify parent component when aircraft change
  useEffect(() => {
    if (onAircraftChange && aircraft?.length >= 0) {
      onAircraftChange(aircraft);
    }
  }, [aircraft, onAircraftChange]);
  
  // Update search term display when manufacturer changes
  useEffect(() => {
    if (selectedManufacturer) {
      const selected = manufacturers.find(m => m.value === selectedManufacturer);
      if (selected) {
        setSearchTerm(selected.label);
      }
    } else {
      setSearchTerm('');
    }
  }, [selectedManufacturer, manufacturers]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsManufacturerDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Toggle minimized state
  const toggleMinimized = () => setIsMinimized(prev => !prev);
  
  // Filter manufacturers by search term
  const filteredManufacturers = React.useMemo(() => {
    if (!searchTerm) return manufacturers;
    
    return manufacturers.filter(manufacturer => 
      manufacturer.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [manufacturers, searchTerm]);
  
  // Handle manufacturer selection
  const handleManufacturerSelect = async (manufacturer: string) => {
    setIsManufacturerDropdownOpen(false);
    
    if (onManufacturerSelect) {
      // Use external handler if provided
      onManufacturerSelect(manufacturer);
    } else {
      // Otherwise use the hook
      await hookSelectManufacturer(manufacturer);
    }
  };
  
  // Handle model selection
  const handleModelSelect = (model: string | null) => {
    if (onModelSelect) {
      // Use external handler if provided
      onModelSelect(model);
    } else {
      // Otherwise use the hook
      hookSelectModel(model);
    }
  };
  
  // Handle reset
  const handleReset = () => {
    setSearchTerm('');
    if (onManufacturerSelect) {
      onManufacturerSelect(null);
      if (onModelSelect) onModelSelect(null);
    } else {
      hookReset();
    }
  };
  
  // Calculate total inactive count for all models
  const totalInactiveCount = React.useMemo(() => {
    return models.reduce(
      (sum, model) => sum + ((model.totalCount || model.count || 0) - (model.activeCount || 0)),
      0
    );
  }, [models]);
  
  // Format model option label
  const formatModelLabel = (model: any) => {
    const totalCount = model.totalCount || model.count || 0;
    const activeCount = model.activeCount || 0;
    const inactiveCount = totalCount - activeCount;

    if (activeCount > 0) {
      return `${model.model} (${activeCount} active, ${inactiveCount} inactive)`;
    } else {
      return `${model.model} (${inactiveCount} inactive)`;
    }
  };
  
  // Handle refresh button click
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await hookRefreshAircraft();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Minimized view
  if (isMinimized) {
    return (
      <button
        onClick={toggleMinimized}
        className="absolute top-4 left-4 z-50 p-2 bg-white rounded-md shadow-lg hover:bg-gray-200"
        aria-label="Expand aircraft selector"
      >
        <Plus size={16} />
      </button>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-4 w-80 absolute top-4 left-4 z-50">
      {/* Header with controls */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={toggleMinimized}
          className="p-1 bg-gray-200 rounded-md hover:bg-gray-300"
          aria-label="Minimize aircraft selector"
        >
          <Minus size={16} />
        </button>
        <h2 className="text-gray-700 text-lg font-medium">Aircraft Selector</h2>
        <div className="flex space-x-2">
          <button
            onClick={handleRefresh}
            className="p-1 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50"
            disabled={isLoading || isRefreshing}
            aria-label="Refresh data"
          >
            <RefreshCw size={16} className={isLoading || isRefreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
            disabled={isLoading}
          >
            Reset
          </button>
        </div>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
          {error}
        </div>
      )}
      
      {/* No manufacturers warning */}
      {manufacturers.length === 0 && !isLoading && (
        <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm">
          No manufacturers found. Please check your database connection.
        </div>
      )}
      
      {/* Manufacturer Selector */}
      <div className="mb-4 relative" ref={dropdownRef}>
        <label 
          htmlFor="manufacturer-input"
          className="block text-gray-700 text-sm font-medium mb-2 flex justify-between"
        >
          <span>Manufacturer</span>
          {isLoading && <span className="text-blue-500 text-xs">Loading...</span>}
        </label>
        <input
          id="manufacturer-input"
          type="text"
          className="w-full px-4 py-2 border rounded-md"
          placeholder="Search or select manufacturer..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsManufacturerDropdownOpen(true)}
          disabled={isLoading || manufacturers.length === 0}
        />
        
        {isManufacturerDropdownOpen && filteredManufacturers.length > 0 && (
          <div className="absolute w-full bg-white border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto z-10">
            {filteredManufacturers.map((manufacturer) => (
              <div
                key={manufacturer.value}
                className={`px-4 py-2 hover:bg-gray-200 cursor-pointer ${
                  isLoading ? 'opacity-50' : ''
                } ${selectedManufacturer === manufacturer.value ? 'bg-blue-100' : ''}`}
                onClick={() => !isLoading && handleManufacturerSelect(manufacturer.value)}
              >
                {manufacturer.label}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Model Selector */}
      {selectedManufacturer && (
        <div className="mb-4">
          <label
            htmlFor="model-select"
            className="block text-gray-700 text-sm font-medium mb-2 flex justify-between"
          >
            <span>Model</span>
            {models.length > 0 && (
              <span className="text-xs text-gray-500">
                {totalActiveModels} active of {totalModels} models
              </span>
            )}
          </label>
          
          <select
            id="model-select"
            className={`w-full p-2 border rounded-md ${
              isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            } ${!selectedModel ? 'text-gray-500' : 'text-gray-900'}`}
            value={selectedModel || ""}
            onChange={(e) => handleModelSelect(e.target.value || null)}
            disabled={isLoading || models.length === 0}
          >
            <option value="">
              {totalActiveAircraft > 0
                ? `All Models (${totalActiveAircraft} active, ${totalInactiveCount} inactive)`
                : `All Models (${totalInactiveCount} inactive)`}
            </option>
            {models.map((model) => (
              <option
                key={model.model}
                value={model.model}
                className={`
                  ${model.activeCount && model.activeCount > 0 ? 'font-medium text-blue-700' : 'text-gray-700'}
                `}
              >
                {formatModelLabel(model)}
              </option>
            ))}
          </select>
          
          {models.length === 0 && !isLoading && (
            <p className="mt-1 text-sm text-gray-500">No models available</p>
          )}
          
          {totalActiveAircraft === 0 && models.length > 0 && (
            <div className="mt-1 text-sm text-red-500 p-1 border border-red-200 rounded bg-red-50">
              No live aircraft found
            </div>
          )}
        </div>
      )}
      
      {/* Status messages */}
      {statusMessage && (
        <div className="p-2 border rounded bg-gray-50">
          <div className="flex items-center">
            {isLoading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            )}
            <span className="text-sm text-gray-700">{statusMessage}</span>
          </div>
        </div>
      )}
      
      {/* Aircraft count */}
      {totalActiveAircraft > 0 && (
        <div className="mt-2 text-sm text-gray-600">
          <div className="flex items-center justify-between">
            <div>
              <span>Tracking</span>
              <span className="ml-1 font-medium text-blue-600">{totalFilteredAircraft}</span>
              <span className="ml-1">aircraft</span>
            </div>
            {selectedModel && totalFilteredAircraft !== totalActiveAircraft && (
              <div className="text-xs text-gray-500">
                ({totalActiveAircraft} total)
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Refresh status */}
      <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
        <div className="flex justify-between">
          <span>Models cached:</span>
          <span>{models.length}</span>
        </div>
        <div className="flex justify-between">
          <span>Last refreshed:</span>
          <span>{lastRefreshed ? lastRefreshed.toLocaleTimeString() : 'Never'}</span>
        </div>
        <div className="flex justify-between items-center mt-2">
          <button
            onClick={handleRefresh}
            className={`w-full py-2 px-4 bg-blue-100 hover:bg-blue-200 text-blue-800 text-sm font-medium rounded-md flex items-center justify-center ${isRefreshing || isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isRefreshing || isLoading}
          >
            <RefreshCw size={14} className={`mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Aircraft Data'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AircraftSelector;