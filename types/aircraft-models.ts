// types/aircraft-models.ts
import { Aircraft, Model } from '@/types/base';

export interface BaseModel {
  model: string;
  manufacturer: string;
  label: string;
}

export interface ActiveModel extends BaseModel {
  activeCount: number; // Required
  totalCount: number; // Required
  label: string; // Required in ActiveModel
}

export interface ModelCount {
  count: number;
  activeCount: number;
  totalCount: number;
}

export interface AircraftModel extends BaseModel, ModelCount {
  icao24s?: string[];
}

export interface SelectOption {
  value: string;
  label: string;
  count?: number;
}

// Utility functions for transformations
export const transformToAircraftModel = (
  aircraft: Aircraft
): AircraftModel => ({
  model: aircraft.model || '',
  manufacturer: aircraft.manufacturer,
  label: `${aircraft.model || 'Unknown'}`,
  count: 1,
  activeCount: aircraft.isTracked ? 1 : 0,
  totalCount: 1,
  icao24s: [aircraft.icao24],
});

export const aggregateAircraftModels = (
  aircraft: Aircraft[]
): AircraftModel[] => {
  const modelMap = new Map<string, AircraftModel>();

  aircraft.forEach((a) => {
    if (!a.model) return; // Skip aircraft without model info

    const key = `${a.manufacturer}-${a.model}`;
    const existing = modelMap.get(key);

    if (existing) {
      existing.count++;
      if (a.isTracked) existing.activeCount++;
      existing.totalCount++;
      if (existing.icao24s && a.icao24) existing.icao24s.push(a.icao24);
    } else {
      modelMap.set(key, transformToAircraftModel(a));
    }
  });

  return Array.from(modelMap.values());
};

// Utility function for type conversion
export function toActiveModel(
  model: AircraftModel | Partial<ActiveModel>
): ActiveModel {
  return {
    model: model.model || '',
    manufacturer: model.manufacturer || '',
    label: model.label || `${model.model || 'Unknown'} (0 active)`,
    activeCount: model.activeCount || 0,
    totalCount: model.totalCount || 0,
  };
}
