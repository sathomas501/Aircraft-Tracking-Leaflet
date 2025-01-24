//lib/db/schema.ts

export const STATIC_SCHEMA = `
    CREATE TABLE IF NOT EXISTS aircraft (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        icao24 TEXT UNIQUE,
        "N-NUMBER" TEXT,
        manufacturer TEXT,
        model TEXT,
        operator TEXT,
        NAME TEXT,
        CITY TEXT,
        STATE TEXT,
        aircraft_type TEXT,
        owner_type TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Optimize indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_aircraft_icao24 ON aircraft(icao24);
    CREATE INDEX IF NOT EXISTS idx_aircraft_manufacturer ON aircraft(manufacturer);
    CREATE INDEX IF NOT EXISTS idx_aircraft_model ON aircraft(model);
    CREATE INDEX IF NOT EXISTS idx_aircraft_type ON aircraft(aircraft_type, owner_type);
    CREATE INDEX IF NOT EXISTS idx_aircraft_operator ON aircraft(operator);


    CREATE TRIGGER IF NOT EXISTS update_aircraft_timestamp 
    AFTER UPDATE ON aircraft
    BEGIN
        UPDATE aircraft 
        SET updated_at = CURRENT_TIMESTAMP 
        WHERE id = NEW.id;
    END;
`;
