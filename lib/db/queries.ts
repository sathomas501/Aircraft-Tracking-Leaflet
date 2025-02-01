import databaseManager from '../db/databaseManager';
import { SelectOption } from '@/types/base';

export interface ManufacturerRow {
    manufacturer: string;
    count: number;
}

export const getActiveManufacturers = async (): Promise<ManufacturerRow[]> => {
    const query = `
        SELECT 
            manufacturer,
            COUNT(*) as count
        FROM aircraft 
        WHERE 
            manufacturer IS NOT NULL 
            AND manufacturer != ''
        GROUP BY manufacturer
        HAVING COUNT(*) > 0
        ORDER BY count DESC, manufacturer ASC;
    `;

    try {
        return await databaseManager.allQuery<ManufacturerRow>(query);
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
};

export const getActiveIcao24ByManufacturer = async (manufacturer: string): Promise<string[]> => {
    const query = `
        SELECT icao24 
        FROM aircraft 
        WHERE 
            manufacturer = ? 
            AND icao24 IS NOT NULL
            AND icao24 != ''
    `;

    try {
        const rows = await databaseManager.allQuery<{ icao24: string }>(query, [manufacturer]);
        return rows.map((row: { icao24: string }) => row.icao24);
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
};

export const getModelsByManufacturer = async (manufacturer: string): Promise<SelectOption[]> => {
    const query = `
        SELECT 
            model as value,
            model as label,
            COUNT(*) as count
        FROM aircraft 
        WHERE 
            manufacturer = ?
            AND model IS NOT NULL 
            AND model != ''
        GROUP BY model
        HAVING count > 0
        ORDER BY count DESC, model ASC;
    `;

    try {
        return await databaseManager.allQuery<SelectOption>(query, [manufacturer]);
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
};