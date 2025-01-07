import { createDbConnection } from './../lib/db/db';
import { SelectOption } from '@/types/types';

export interface ManufacturerRow {
    manufacturer: string;
    count: number;
}

export const getActiveManufacturers = async (activeOnly: boolean = false): Promise<ManufacturerRow[]> => {
    const query = `
        SELECT 
            manufacturer,
            COUNT(*) as count
        FROM aircraft 
        WHERE 
            manufacturer IS NOT NULL 
            AND manufacturer != ''
            ${activeOnly ? 'AND active = 1' : ''}
        GROUP BY manufacturer
        HAVING COUNT(*) > 0
        ORDER BY count DESC, manufacturer ASC;
    `;

    const db = createDbConnection();
    return new Promise((resolve, reject) => {
        db.all(query, [], (err, rows: ManufacturerRow[]) => {
            db.close();
            if (err) {
                console.error('Database query error:', err);
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
};

export const getActiveIcao24ByManufacturer = async (manufacturer: string): Promise<string[]> => {
    const query = `
        SELECT icao24 
        FROM aircraft 
        WHERE 
            manufacturer = ? 
            AND active = 1
            AND icao24 IS NOT NULL
            AND icao24 != ''
    `;

    const db = createDbConnection();
    return new Promise((resolve, reject) => {
        db.all(query, [manufacturer], (err, rows: { icao24: string }[]) => {
            db.close();
            if (err) {
                console.error('Database query error:', err);
                reject(err);
            } else {
                resolve(rows.map(row => row.icao24));
            }
        });
    });
};

export const getModelsByManufacturer = async (
    manufacturer: string, 
    activeOnly: boolean = false
): Promise<SelectOption[]> => {
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
            ${activeOnly ? 'AND active = 1' : ''}
        GROUP BY model
        HAVING count > 0
        ORDER BY count DESC, model ASC;
    `;

    const db = createDbConnection();
    return new Promise((resolve, reject) => {
        db.all(query, [manufacturer], (err, rows: SelectOption[]) => {
            db.close();
            if (err) {
                console.error('Database query error:', err);
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
};