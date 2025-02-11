// utils/database-transforms.ts
import type { Aircraft } from '@/types/base';

export class DatabaseTransforms {
  static toBatch(aircraft: Aircraft[]): any[] {
    return aircraft.map((a) => ({
      icao24: a.icao24,
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
    staticData.map((aircraft) => [aircraft.icao24.toLowerCase(), aircraft]) // Ensure case insensitivity
  );

  return liveData.map((live) => {
    const staticInfo: Aircraft | undefined = staticDataMap.get(
      live.icao24.toLowerCase()
    );

    return {
      ...live,
      isTracked: true, // Ensures tracking indicator

      // Merge static data if available, otherwise fallback to default values
      ['N-NUMBER']: staticInfo?.['N-NUMBER'] || '',
      manufacturer: staticInfo?.manufacturer || 'Unknown',
      model: staticInfo?.model || 'Unknown',
      NAME: staticInfo?.NAME || '',
      CITY: staticInfo?.CITY || '',
      STATE: staticInfo?.STATE || '',
      TYPE_AIRCRAFT: staticInfo?.TYPE_AIRCRAFT || 'Unknown',
      OWNER_TYPE: staticInfo?.OWNER_TYPE || 'Unknown',
    };
  });
}
