import axios from 'axios';

const BASE_URL = 'https://opensky-network.org/api';

/**
 * Fetches positions for a list of ICAO24 codes.
 * @param icao24List - Array of ICAO24 codes.
 * @returns Promise with position data.
 */
export const fetchOpenskyPositions = async (icao24List: string[]): Promise<any> => {
  if (!icao24List || icao24List.length === 0) {
    throw new Error('ICAO24 list cannot be empty');
  }

  try {
    const response = await axios.post(`${BASE_URL}/positions`, { icao24: icao24List });
    return response.data;
  } catch (error) {
    console.error('Error fetching positions from OpenSky:', error);
    throw new Error('Failed to fetch positions');
  }
};

/**
 * Fetches models for a specific manufacturer.
 * @param manufacturer - Manufacturer name.
 * @returns Promise with model data.
 */
export const fetchOpenskyModels = async (manufacturer: string): Promise<any> => {
  if (!manufacturer) {
    throw new Error('Manufacturer cannot be empty');
  }

  try {
    const response = await axios.get(`${BASE_URL}/models`, { params: { manufacturer } });
    return response.data;
  } catch (error) {
    console.error('Error fetching models from OpenSky:', error);
    throw new Error('Failed to fetch models');
  }
};

/**
 * Fetches aircraft manufacturers.
 * @returns Promise with manufacturer data.
 */
export const fetchOpenskyManufacturers = async (): Promise<any> => {
  try {
    const response = await axios.get(`${BASE_URL}/manufacturers`);
    return response.data;
  } catch (error) {
    console.error('Error fetching manufacturers from OpenSky:', error);
    throw new Error('Failed to fetch manufacturers');
  }
};
