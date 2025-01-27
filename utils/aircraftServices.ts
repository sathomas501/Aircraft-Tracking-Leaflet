// utils/aircraftServices.ts
import axios from 'axios';
import { getActiveIcao24ByManufacturer } from '@/lib/db/queries';
import { OpenSkyManager } from '@/lib/services/opensky/service';
import type { SelectOption, PositionData } from '@/types/base';

interface ManufacturerRow {
    manufacturer: string;
    count: number;
}

interface Icao24Response {
    icao24List: string[];
}

interface ModelsResponse {
    models: SelectOption[];
}

export const fetchManufacturers = async (activeOnly: boolean): Promise<SelectOption[]> => {
    try {
        const response = await axios.get<{ manufacturers: ManufacturerRow[] }>('/api/manufacturer', {
            params: { activeOnly }
        });

        return response.data.manufacturers.map((row: ManufacturerRow) => ({
            value: row.manufacturer,
            label: row.manufacturer,
            count: row.count,
        }));
    } catch (error) {
        console.error('Error fetching manufacturers:', error);
        return [];
    }
};

export const fetchIcao24FromDB = async (manufacturer: string): Promise<string[]> => {
    return await getActiveIcao24ByManufacturer(manufacturer);
};

export const fetchIcao24FromAPI = async (manufacturer: string): Promise<string[]> => {
    if (!manufacturer) {
        console.warn('No manufacturer provided to fetchIcao24FromAPI');
        return [];
    }

    try {
        const response = await axios.get<Icao24Response>('/api/manufacturers/icao24s', { 
            params: { manufacturer: manufacturer.trim() }
        });
        return response.data.icao24List || [];
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Error fetching ICAO24 list from API:', error.response?.data || error.message);
        } else {
            console.error('Error fetching ICAO24 list from API:', error);
        }
        return [];
    }
};

export const fetchModels = async (manufacturer: string, activeOnly: boolean = false): Promise<SelectOption[]> => {
    try {
        const response = await axios.get<ModelsResponse>('/api/aircraft/models', {
            params: { manufacturer, activeOnly }
        });
        return response.data.models;
    } catch (error) {
        console.error('Error fetching models:', error);
        return [];
    }
};

export const fetchAircraftPositions = async (icao24List: string[]): Promise<PositionData[]> => {
    try {
        const openSkyManager = OpenSkyManager.getInstance(); // No config needed due to defaults
        return await openSkyManager.getPositions(icao24List);
    } catch (error) {
        console.error('Error fetching aircraft positions:', error);
        return [];
    }
};


