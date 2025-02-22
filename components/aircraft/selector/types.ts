// components/aircraft/selector/types.ts
import { Aircraft, SelectOption, StaticModel } from '../../../types/base';

export interface ManufacturerSelectorProps {
  manufacturers: SelectOption[];
  selectedManufacturer: string | null;
  onSelect: (manufacturer: string | null) => Promise<void>;
  onAircraftUpdate: (aircraft: Aircraft[]) => void;
  onModelsUpdate: (models: Aircraft[]) => void; // Keep consistent with current usage
  onError: (message: string) => void;
}

export interface ModelSelectorProps {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  models: StaticModel[];
  totalActive?: number;
  onModelSelect: (model: string) => void;
}

export interface UnifiedSelectorProps {
  manufacturers: SelectOption[];
  selectedManufacturer: string;
  selectedModel: string;
  setSelectedManufacturer: (manufacturer: string | null) => void;
  setSelectedModel: (model: string) => void;
  onManufacturerSelect: (manufacturer: string | null) => Promise<void>;
  onModelSelect: (model: string) => void;
  onAircraftUpdate: (aircraft: Aircraft[]) => void;
  onModelsUpdate: (models: Aircraft[]) => void; // Keep consistent with current usage
  onReset: () => void;
  onError: (message: string) => void;
  models: StaticModel[];
  modelCounts: Record<string, number>;
  totalActive?: number;
}
