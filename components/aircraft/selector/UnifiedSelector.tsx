import React, { useState, useEffect } from 'react';
import { fetchAircraftPositions, fetchManufacturers } from '@/utils/aircraftServices';
import type { SelectOption } from '@/types/base';

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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadManufacturers = async () => {
      try {
        setLoading(true);
        const options = await fetchManufacturers(false);
        setManufacturers(options);
      } catch (error) {
        console.error('Error fetching manufacturers:', error);
        setError('Unable to load manufacturers. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadManufacturers();
  }, []);

  const handleManufacturerChange = async (manufacturer: string) => {
    onManufacturerSelect(manufacturer);

    if (!manufacturer) return;

    try {
      const positions = await fetchAircraftPositions([manufacturer]);
      console.log('Fetched active aircraft positions:', positions);
    } catch (err) {
      console.error('Error fetching aircraft positions:', err);
    }
  };

  if (loading) return <div>Loading manufacturers...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div>
      <h1>Aircraft Selector</h1>
      <p>Selected Type: {selectedType}</p>
      {/* Manufacturer Dropdown */}
      <select
        value={selectedManufacturer}
        onChange={(e) => handleManufacturerChange(e.target.value)}
        className="w-full p-2 border rounded"
      >
        <option value="">Select Manufacturer</option>
        {manufacturers.map((manufacturer) => (
          <option key={manufacturer.value} value={manufacturer.value}>
            {manufacturer.label} ({manufacturer.count})
          </option>
        ))}
      </select>

      {/* Model Dropdown */}
      <select
        value={selectedModel}
        onChange={(e) => onModelSelect(e.target.value)}
        className="w-full p-2 border rounded mt-2"
        disabled={!selectedManufacturer}
      >
        <option value="">Select Model</option>
        {/* Future enhancement: Populate models dynamically */}
      </select>
    </div>
  );
};

export default UnifiedSelector;