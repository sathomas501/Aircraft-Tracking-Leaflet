// utils/model-transforms.ts
import { Aircraft } from '../types/base';
import { AircraftModel } from '../types/aircraft-models';

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
    if (!a.model) return;

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
