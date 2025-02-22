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

export interface UnifiedSelectorProps {
  manufacturers: SelectOption[];
  selectedManufacturer: string;
  selectedModel: string;
  setSelectedManufacturer: (manufacturer: string | null) => void; // Match the handler signature
  setSelectedModel: (model: string) => void;
  onManufacturerSelect: (manufacturer: string | null) => Promise<void>;
  onModelSelect: (model: string) => void;
  onAircraftUpdate: (aircraft: Aircraft[]) => void;
  onModelsUpdate: (models: AircraftModel[]) => void; // Changed to AircraftModel
  onReset: () => void;
  onError: (message: string) => void;
  models: AircraftModel[]; // Changed to AircraftModel
  modelCounts: Record<string, number>;
  totalActive?: number;
}
