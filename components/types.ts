// components/aircraft/selector/types.ts
import { Aircraft, SelectOption } from '@/types/base';

// Base MODEL interface with common properties
export interface BaseModel {
  MODEL: string;
  MANUFACTURER: string;
  label: string;
}

// Model with active count information
export interface AircraftModel extends BaseModel {
  activeCount: number;
  totalCount: number;
  ICAO24s?: string[];
}

export interface ManufacturerSelectorProps {
  manufacturers: SelectOption[];
  selectedManufacturer: string | null;
  onSelect: (MANUFACTURER: string | null) => Promise<void>;
  onAircraftUpdate: (aircraft: Aircraft[]) => void;
  onModelsUpdate: (models: AircraftModel[]) => void; // Changed to AircraftModel
  onError: (message: string) => void;
}

export interface ModelSelectorProps {
  selectedModel: string;
  setSelectedModel: (MODEL: string) => void;
  models: AircraftModel[]; // Changed to AircraftModel
  totalActive: number;
  onModelSelect: (MODEL: string) => void;
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
  setSelectedManufacturer?: (MANUFACTURER: string | null) => void; // Now optional
  setSelectedModel?: (MODEL: string) => void; // Now optional
  onManufacturerSelect: (MANUFACTURER: string | null) => Promise<void> | void; // Allow non-Promise return
  onModelSelect: (MODEL: string | null) => void; // Allow null
  onAircraftUpdate?: (aircraft: Aircraft[]) => void; // Now optional
  onModelsUpdate?: (models: AircraftModel[]) => void; // Now optional
  onReset: () => void;
  onError: (message: string) => void;

  // UI state props
  isLoading?: boolean; // Add this
  trackingStatus?: string; // Add this
}
