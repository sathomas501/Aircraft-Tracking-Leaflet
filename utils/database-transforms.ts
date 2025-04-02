// utils/database-transforms.ts
import type { Aircraft } from '@/types/base';

export class DatabaseTransforms {
  static toBatch(aircraft: Aircraft[]): any[] {
    return aircraft.map((a) => ({
      ICAO24: a.ICAO24,
      latitude: a.latitude,
      longitude: a.longitude,
      heading: a.heading,
      updated_at: Math.floor(Date.now() / 1000),
    }));
  }
}

export function mergeStaticAndLiveData(
  liveData: Aircraft[],
  staticData: Aircraft[]
): Aircraft[] {
  const staticDataMap: Map<string, Aircraft> = new Map(
    staticData.map((aircraft) => [aircraft.ICAO24.toLowerCase(), aircraft]) // Ensure case insensitivity
  );

  return liveData.map((live) => {
    const staticInfo: Aircraft | undefined = staticDataMap.get(
      live.ICAO24.toLowerCase()
    );

    return {
      ...live,
      isTracked: true, // Ensures tracking indicator

      // Merge static data if available, otherwise fallback to default values
      ['N_NUMBER']: staticInfo?.['N_NUMBER'] || '',
      MANUFACTURER: staticInfo?.MANUFACTURER || 'Unknown',
      MODEL: staticInfo?.MODEL || 'Unknown',
      NAME: staticInfo?.NAME || '',
      CITY: staticInfo?.CITY || '',
      STATE: staticInfo?.STATE || '',
      AIRCRAFT_TYPE: staticInfo?.AIRCRAFT_TYPE || 'Unknown',
      OWNER_TYPE: staticInfo?.OWNER_TYPE || 'Unknown',
    };
  });
}
