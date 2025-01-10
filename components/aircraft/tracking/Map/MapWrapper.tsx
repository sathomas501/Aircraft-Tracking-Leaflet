import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Menu } from 'lucide-react';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { Aircraft } from '@/types/base';
import { AIRCRAFT } from '@/constants/aircraft';
import 'leaflet/dist/leaflet.css';

// Define type for state
type AircraftState = {
  selectedManufacturer: string;
  selectedModel: string;
  selectedType: string;
  selectedAircraftId: string | null;
};

// Dynamically import map component with no SSR
const MapComponent = dynamic(
  () => import('./MapComponent'),
  { 
    loading: () => <LoadingSpinner message="Loading map..." />,
    ssr: false
  }
);

// Dynamically import selector with no SSR
const UnifiedSelector = dynamic(
  () => import('@/components/aircraft/selector/UnifiedSelector'),
  { 
    loading: () => null,
    ssr: false
  }
);

export function MapWrapper() {
  // State management
  const [selectedManufacturer, setSelectedManufacturer] = useState<AircraftState['selectedManufacturer']>(
    AIRCRAFT.DEFAULT_STATE.selectedManufacturer
  );
  const [selectedModel, setSelectedModel] = useState<AircraftState['selectedModel']>(
    AIRCRAFT.DEFAULT_STATE.selectedModel
  );
  const [selectedType, setSelectedType] = useState<AircraftState['selectedType']>(
    AIRCRAFT.DEFAULT_STATE.selectedType
  );
  const [isSelectorOpen, setIsSelectorOpen] = useState(true);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);

  useEffect(() => {
    console.log('MapWrapper mounted');
    setIsMapReady(true);
    return () => {
      console.log('MapWrapper unmounted');
    };
  }, []);

  const handleManufacturerSelect = (manufacturer: string) => {
    console.log('Manufacturer selected:', manufacturer);
    setSelectedManufacturer(manufacturer);
    setSelectedModel(''); // Reset model when manufacturer changes
  };

  const handleModelSelect = (model: string) => {
    console.log('Model selected:', model);
    setSelectedModel(model);
  };

  const handleAircraftUpdate = (newAircraft: Aircraft[]) => {
    console.log('Aircraft updated:', newAircraft?.length || 0, 'aircraft');
    setAircraft(newAircraft);
  };

  const toggleSelector = () => {
    console.log('Toggling selector, current state:', !isSelectorOpen);
    setIsSelectorOpen(prev => !prev);
  };

  if (!isMapReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <LoadingSpinner message="Initializing map..." />
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-gray-100">
      {/* Map Container */}
      <div className="absolute inset-0">
        <MapComponent aircraft={aircraft} />
      </div>

      {/* Toggle Button - Always visible */}
      <button
        onClick={toggleSelector}
        className="absolute top-4 left-4 z-[1000] bg-white p-2 rounded-full shadow-lg
                 hover:bg-gray-100 transition-colors duration-200"
        title={isSelectorOpen ? "Hide selector" : "Show selector"}
      >
        <Menu size={24} />
      </button>

      {/* Selector Panel */}
      <div className="absolute top-4 left-16 z-[1000]">
        <UnifiedSelector
          selectedType={selectedType}
          onManufacturerSelect={handleManufacturerSelect}
          onModelSelect={handleModelSelect}
          selectedManufacturer={selectedManufacturer}
          selectedModel={selectedModel}
          onAircraftUpdate={handleAircraftUpdate}
          isOpen={isSelectorOpen}
          onToggle={toggleSelector}
        />
      </div>
    </div>
  );
}