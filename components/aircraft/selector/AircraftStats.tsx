import React from 'react';
import { useAircraftData } from '../customHooks/useAircraftData';

interface AircraftStatsProps {
  manufacturer: string;
  model: string;
  selectedType: string;
  totalActive?: number;
}

const AircraftStats: React.FC<AircraftStatsProps> = ({
  manufacturer,
  model,
  selectedType,
  totalActive = 0,
}) => {
  return (
    <div className="p-4">
      <div className="text-gray-700 text-lg">
        {manufacturer || 'Select Aircraft'}
      </div>
      <div className="text-blue-600 mb-4">
        Active Aircraft: {totalActive}
        {model && ` - Model: ${model}`}
        {selectedType && ` - Type: ${selectedType}`}
      </div>
    </div>
  );
};

export default AircraftStats;
