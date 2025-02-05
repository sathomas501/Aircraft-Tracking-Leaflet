import { SelectOption } from '@/types/base';

export interface Model {
  model: string;
  count?: number;
}

export interface AircraftResponse {
  manufacturers: SelectOption[];
  models: Model[];
  activeCount: number;
}

export const fetchManufacturers = async () => {
  try {
    const response = await fetch('/api/manufacturers');
    const data = await response.json();
    return data.manufacturers || [];
  } catch (error) {
    console.error('Error fetching manufacturers:', error);
    return [];
  }
};

export const fetchModels = async (manufacturer: string): Promise<Model[]> => {
  try {
    if (!manufacturer) return [];
    const response = await fetch(`/api/aircraft/models?manufacturer=${encodeURIComponent(manufacturer)}`);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching models:', error);
    return [];
  }
};

export const trackManufacturer = async (manufacturer: string) => {
  try {
    const response = await fetch('/api/aircraft/track-manufacturer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manufacturer })
    });
    const data = await response.json();
    return {
      liveAircraft: data.liveAircraft || [],
      icao24s: data.icao24s || []
    };
  } catch (error) {
    console.error('Error tracking manufacturer:', error);
    return { liveAircraft: [], icao24s: [] };
  }
};