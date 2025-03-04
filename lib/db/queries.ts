import { SelectOption } from '@/types/base';

export interface ManufacturerRow {
  manufacturer: string;
  count: number;
}

export const getActiveManufacturers = async (): Promise<
  { manufacturer: string; count: number }[]
> => {
  try {
    const response = await fetch('/api/db/queries'); // ✅ Calls API instead of using sqlite directly
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.manufacturers;
  } catch (error) {
    console.error('Error fetching manufacturers:', error);
    return [];
  }
};

export const getActiveIcao24ByManufacturer = async (
  manufacturer: string
): Promise<string[]> => {
  try {
    const response = await fetch(
      `/api/db/queries?action=getActiveIcao24ByManufacturer&manufacturer=${encodeURIComponent(manufacturer)}`
    );
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    const data = await response.json();
    return data.icao24s || [];
  } catch (error) {
    console.error('Error fetching ICAO24 by manufacturer:', error);
    return [];
  }
};
