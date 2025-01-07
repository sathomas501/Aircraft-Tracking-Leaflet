import React, { useState, useEffect } from 'react';

interface SelectOption {
  value: string;
  label: string;
  count: number;
}


interface UnifiedSelectorProps {
  selectedType: string;
  onManufacturerSelect: (manufacturer: string) => void;
  onModelSelect: (model: string) => void;
  selectedManufacturer: string;
  selectedModel: string;
}

const UnifiedSelector: React.FC<UnifiedSelectorProps> = ({
  selectedType,
  onManufacturerSelect,
  onModelSelect,
  selectedManufacturer,
  selectedModel,
}) => {

  const [manufacturers, setManufacturers] = useState<SelectOption[]>([]);

  const fetchManufacturers = async (): Promise<SelectOption[]> => {
    try {
      const response = await fetch('/api/manufacturers');
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      return data.manufacturers || [];
    } catch (error) {
      console.error('Failed to fetch manufacturers:', error);
      return [];
    }
  };

  useEffect(() => {
    const fetchManufacturersData = async () => {
      const manufacturersData = await fetchManufacturers();
      setManufacturers(manufacturersData);
    };

    fetchManufacturersData();
  }, []);

  return (
    <div>
      <h1>Unified Selector</h1>
      {/* Example UI */}
      <p>Selected Type: {selectedType}</p>
      <select value={selectedManufacturer} onChange={(e) => onManufacturerSelect(e.target.value)}>
        <option value="">Select Manufacturer</option>
        {/* Options would go here */}
      </select>
      <select value={selectedModel} onChange={(e) => onModelSelect(e.target.value)}>
        <option value="">Select Model</option>
        {/* Options would go here */}
      </select>
    </div>
  );
};

export default UnifiedSelector;
