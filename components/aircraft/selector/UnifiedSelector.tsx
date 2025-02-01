// components/aircraft/selector/UnifiedSelector.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, RotateCcw, Search, Plane } from 'lucide-react';
import type { SelectOption } from '@/types/base';

interface UnifiedSelectorProps {
  selectedType: string;
  selectedManufacturer: string;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  modelCounts: Map<string, number>;
  totalActive: number; // <-- Ensure this is passed in `MapWrapper.tsx`
  onManufacturerSelect: (manufacturer: string) => void;
  onModelSelect: (model: string) => void;
  onAircraftUpdate: (updateData: any) => void;
  onReset: () => void;
}

const UnifiedSelector: React.FC<UnifiedSelectorProps> = ({
  selectedType,
  selectedManufacturer,
  selectedModel,
  setSelectedModel,
  modelCounts,
  totalActive,
  onManufacturerSelect,
  onModelSelect,
  onAircraftUpdate,
  onReset
}) => {

  const [manufacturers, setManufacturers] = useState<SelectOption[]>([]);
  const [models, setModels] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isManufacturerOpen, setIsManufacturerOpen] = useState(false);
  const [searchMode, setSearchMode] = useState<'manufacturer' | 'nNumber'>('manufacturer');
  const [nNumber, setNNumber] = useState('');

  const handleReset = () => {
    setSearchTerm('');
    setSelectedModel('');
    setIsManufacturerOpen(false);  // ✅ Close the dropdown when resetting
    setError(null);
    setNNumber('');
    onReset();
  };

  const getDisplayText = () => {
    if (!selectedManufacturer) {
      return 'Search manufacturer...';
    }
    if (selectedModel) {
      const modelCount = modelCounts.get(selectedModel) || 0;
      return `${selectedManufacturer} - ${selectedModel} (${modelCount} active)`;
    }
    return `${selectedManufacturer} (${totalActive} active)`;
  };
  
  // Filter manufacturers
  const filteredManufacturers = useMemo(() => {
    if (!Array.isArray(manufacturers)) return [];  // ✅ Prevents undefined errors
    if (!searchTerm) {
        return manufacturers
            .filter(manufacturer => manufacturer?.label)  // ✅ Ensures all items have a label
            .sort((a, b) => a.label.localeCompare(b.label));  // ✅ Prevents TypeError
    }

    const lowerSearch = searchTerm.toLowerCase();  // ✅ Avoid calling `.toLowerCase()` multiple times

    return manufacturers
        .filter(manufacturer => manufacturer?.label && manufacturer.label.toLowerCase().includes(lowerSearch))
        .sort((a, b) => a.label.localeCompare(b.label));
}, [manufacturers, searchTerm]);  // ✅ Ensures updates only when necessary


  // Fetch manufacturers
const fetchManufacturers = useCallback(async () => {
  try {
    setLoading(true);
    setError(null);
    
    const response = await fetch('/api/manufacturers');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.manufacturers) {
      throw new Error('No manufacturers data received');
    }

    setManufacturers(data.manufacturers);
  } catch (err) {
    console.error('Error fetching manufacturers:', err);
    setError('Failed to load manufacturers. Please try again.');
  } finally {
    setLoading(false);
  }
}, []);

useEffect(() => {
  let isMounted = true;

  fetchManufacturers().then(() => {
      if (!isMounted) return; // ✅ Prevents state updates on unmounted components
  });

  return () => {
      isMounted = false; // ✅ Cleanup function
  };
}, []);


  // Fetch models when manufacturer changes
  useEffect(() => {
    const fetchModels = async () => {
      if (!selectedManufacturer) {
        setModels([]);
        return;
      }

      try {
        const response = await fetch(`/api/aircraft/models?manufacturer=${encodeURIComponent(selectedManufacturer)}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setModels(data.models || []);
      } catch (err) {
        console.error('Error fetching models:', err);
        setError('Failed to load models');
      }
    };

    fetchModels();
  }, [selectedManufacturer]);

  // Handle N-Number search
  const handleNNumberSearch = async () => {
    if (!nNumber) return;

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/aircraft/n-number/${encodeURIComponent(nNumber)}`);
      
      if (!response.ok) {
        throw new Error(`Aircraft not found`);
      }

      const data = await response.json();
      onAircraftUpdate([data]); // Update with the found aircraft
    } catch (err) {
      console.error('Error searching N-Number:', err);
      setError('Aircraft not found or invalid N-Number');
    } finally {
      setLoading(false);
    }
  };

// ✅ Minimize (collapse) dropdown toggle
const handleMinimize = () => {
  setIsManufacturerOpen((prev) => !prev); // Toggle dropdown visibility
};

const handleManufacturerSelect = async (selectedMfr: string) => {
  try {
    setLoading(true);
    setError(null);

    await onManufacturerSelect(selectedMfr);
    setSearchTerm('');
    setIsManufacturerOpen(false); // Collapse dropdown after selection

    const response = await fetch('/api/aircraft/track-manufacturer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manufacturer: selectedMfr, model: selectedModel || null }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.message || "Failed to track manufacturer");
      return;
    }

    const aircraftList = data.liveAircraft || data.aircraft || [];
    onAircraftUpdate(aircraftList);

    setSelectedModel('');
    setModels([]);
    setSearchTerm('');
  } catch (error) {
    console.error("[Frontend] Error tracking manufacturer:", error);
    setError(error instanceof Error ? error.message : "An unknown error occurred");
  } finally {
    setLoading(false);
  }
};

return (
  <div className="bg-white rounded-lg shadow-lg p-3 max-w-md">
    <div className="flex justify-between items-center mb-3">
      <h2 className="text-base font-semibold text-white bg-blue-500 px-3 py-1 rounded-md">
        {totalActive > 0 ? `Active Aircraft (${totalActive})` : 'Aircraft Selector'}
      </h2>
      <div className="flex space-x-2">
        <button 
          onClick={handleReset} 
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-3 py-1 text-sm"
        >
          Reset
        </button>
        <button 
          onClick={handleMinimize} 
          className="bg-blue-500 hover:bg-blue-600 text-white p-1 rounded-full"
          title="Minimize" // ✅ Tooltip for accessibility
        >
          <RotateCcw size={16} /> {/* ✅ Replaced 'X' with RotateCcw */}
        </button>
      </div>
    </div>

    {isManufacturerOpen && (
      <div>
        <div className="flex space-x-2 mb-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsManufacturerOpen(true);
              }}
              onFocus={() => setIsManufacturerOpen(true)}
              placeholder="Search manufacturer..."
              className="w-full py-1.5 px-7 text-white bg-blue-500 placeholder-blue-200 text-sm border border-blue-600 rounded-md"
            />
            <Search className="absolute left-2 top-2 text-blue-200" size={14} />
          </div>
          <div className="relative">
            <input
              type="text"
              value={nNumber}
              onChange={(e) => setNNumber(e.target.value.toUpperCase())}
              placeholder="N-Number"
              className="w-24 py-1.5 px-7 text-white bg-blue-500 placeholder-blue-200 text-sm border border-blue-600 rounded-md"
              maxLength={6}
            />
            <Plane className="absolute left-2 top-2 text-blue-200" size={14} />
          </div>
        </div>

        {isManufacturerOpen && filteredManufacturers.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
            {filteredManufacturers.map((manufacturer) => (
              <button
                key={manufacturer.value}
                onClick={() => handleManufacturerSelect(manufacturer.value)}
                className="w-full px-3 py-1.5 text-left hover:bg-blue-50 text-sm"
              >
                <div className="flex justify-between items-center">
                  <span>{manufacturer.label}</span>
                  <span className="text-sm text-gray-500">
                    {manufacturer.count?.toLocaleString()} total
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    )}
  </div>
  );
};

export default UnifiedSelector;