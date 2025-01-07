import sqlite3 from 'sqlite3';
import path from 'path';

export const createDbConnection = () => {
    const dbPath = path.join(process.cwd(), 'lib','db', 'aircraft.db');
    console.log('Current working directory:', process.cwd());
    console.log('Database Path:', dbPath);

    return new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error('Error connecting to database:', err);
            throw err;
        }
    });
};