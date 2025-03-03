// components/aircraft/selector/types.ts
import { Aircraft, SelectOption } from '@/types/base';

// Base model interface with common properties
export interface BaseModel {
  model: string;
  manufacturer: string;
  label: string;
}

// Model with active count information
export interface AircraftModel extends BaseModel {
  activeCount: number;
  totalCount: number;
  icao24s?: string[];
}

export interface ManufacturerSelectorProps {
  manufacturers: SelectOption[];
  selectedManufacturer: string | null;
  onSelect: (manufacturer: string | null) => Promise<void>;
  onAircraftUpdate: (aircraft: Aircraft[]) => void;
  onModelsUpdate: (models: AircraftModel[]) => void; // Changed to AircraftModel
  onError: (message: string) => void;
}

export interface ModelSelectorProps {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  models: AircraftModel[]; // Changed to AircraftModel
  totalActive: number;
  onModelSelect: (model: string) => void;
}

// In types.ts
export interface UnifiedSelectorProps {
  // Data props
  manufacturers: SelectOption[];
  selectedManufacturer: string;
  selectedModel: string;
  models: AircraftModel[];
  modelCounts: Record<string, number>;
  totalActive?: number;

  // Handler props
  setSelectedManufacturer?: (manufacturer: string | null) => void; // Now optional
  setSelectedModel?: (model: string) => void; // Now optional
  onManufacturerSelect: (manufacturer: string | null) => Promise<void> | void; // Allow non-Promise return
  onModelSelect: (model: string | null) => void; // Allow null
  onAircraftUpdate?: (aircraft: Aircraft[]) => void; // Now optional
  onModelsUpdate?: (models: AircraftModel[]) => void; // Now optional
  onReset: () => void;
  onError: (message: string) => void;

  // UI state props
  isLoading?: boolean; // Add this
  trackingStatus?: string; // Add this
}
