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

export interface TrackManufacturerResponse {
  liveAircraft: string[]; // Adjust type if needed
  icao24s: string[];
}

export const fetchIcao24s = async (manufacturer: string): Promise<string[]> => {
  if (!manufacturer) return [];

  try {
    const response = await fetch(
      `/api/aircraft/icao24s?manufacturer=${encodeURIComponent(manufacturer)}`
    );
    if (!response.ok)
      throw new Error(`Failed to fetch ICAO24s: ${response.status}`);

    const data = await response.json();
    return data.data.icao24List || [];
  } catch (error) {
    console.error('Error fetching ICAO24s:', error);
    return [];
  }
};

// ✅ Fetch manufacturers with explicit return type
export async function fetchManufacturers() {
  try {
    const response = await fetch('/api/manufacturers', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log('📡 API Manufacturers Response:', data); // ✅ Debugging

    // ✅ Extract manufacturers array from the API response
    if (!data.manufacturers || !Array.isArray(data.manufacturers)) {
      console.warn('⚠️ Unexpected API response format:', data);
      return [];
    }

    console.log('✔️ Extracted Manufacturers:', data.manufacturers);
    return data.manufacturers;
  } catch (error) {
    console.error('❌ Failed to fetch manufacturers:', error);
    return [];
  }
}

// ✅ Fetch models with improved data parsing
export const fetchModels = async (manufacturer: string): Promise<string[]> => {
  if (!manufacturer) return [];

  try {
    const response = await fetch(
      `/api/aircraft/models?manufacturer=${encodeURIComponent(manufacturer)}`
    );
    if (!response.ok)
      throw new Error(`Failed to fetch models: ${response.status}`);

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching models:', error);
    return [];
  }
};

// ✅ Track manufacturer with improved request structure
export const trackManufacturer = async (manufacturer: string) => {
  try {
<<<<<<< Updated upstream
    const response = await fetch('/api/aircraft/tracking', {
=======
    const response = await fetch('/api/aircraft/byManufacturer', {
>>>>>>> Stashed changes
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manufacturer }),
    });
    const data = await response.json();
    return {
      liveAircraft: data.aircraft || [],
      icao24s: data.icao24s || [],
    };
  } catch (error) {
    console.error('Error tracking manufacturer:', error);
    return { liveAircraft: [], icao24s: [] };
  }
};

export const fetchAircraftByNNumber = async (nNumber: string): Promise<any> => {
  if (!nNumber) return null;

  try {
    const response = await fetch(
      `/api/aircraft/searchByNNumber?nNumber=${encodeURIComponent(nNumber)}`
    );
    if (!response.ok)
      throw new Error(`Failed to fetch aircraft: ${response.status}`);

    const data = await response.json();
    return data.data || null;
  } catch (error) {
    console.error('Error fetching aircraft by N-Number:', error);
    return null;
  }
};
