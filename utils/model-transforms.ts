// utils/MODEL-transforms.ts
import { Aircraft } from '../types/base';
import { AircraftModel } from '../types/aircraft-models';

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
    if (!a.MODEL) return;

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
