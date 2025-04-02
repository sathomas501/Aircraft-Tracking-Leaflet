// types/aircraft-models.ts
import { Aircraft } from '@/types/base';

export interface BaseModel {
  MODEL: string;
  MANUFACTURER: string;
  label: string;
}

export interface ModelCount {
  count: number;
  activeCount: number;
  totalCount: number;
}

export interface AircraftModel extends BaseModel, ModelCount {
  ICAO24s?: string[];
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
  MODEL: aircraft.MODEL || '',
  MANUFACTURER: aircraft.MANUFACTURER,
  label: `${aircraft.MODEL || 'Unknown'}`,
  count: 1,
  activeCount: aircraft.isTracked ? 1 : 0,
  totalCount: 1,
  ICAO24s: [aircraft.ICAO24],
});

export const aggregateAircraftModels = (
  aircraft: Aircraft[]
): AircraftModel[] => {
  const modelMap = new Map<string, AircraftModel>();

  aircraft.forEach((a) => {
    if (!a.MODEL) return; // Skip aircraft without MODEL info

    const key = `${a.MANUFACTURER}-${a.MODEL}`;
    const existing = modelMap.get(key);

    if (existing) {
      existing.count++;
      if (a.isTracked) existing.activeCount++;
      existing.totalCount++;
      if (existing.ICAO24s && a.ICAO24) existing.ICAO24s.push(a.ICAO24);
    } else {
      modelMap.set(key, transformToAircraftModel(a));
    }
  });

  return Array.from(modelMap.values());
};
