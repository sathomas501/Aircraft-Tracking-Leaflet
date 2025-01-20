// lib/db/tracking-schema.ts
export const TRACKING_SCHEMA = `
    -- Active aircraft tracking table
    CREATE TABLE IF NOT EXISTS active_tracking (
        icao24 TEXT PRIMARY KEY,
        manufacturer TEXT NOT NULL,
        model TEXT,
        latitude REAL,
        longitude REAL,
        altitude REAL,
        velocity REAL,
        heading REAL,
        on_ground INTEGER DEFAULT 0,
        last_contact INTEGER,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(icao24)
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_tracking_manufacturer 
    ON active_tracking(manufacturer);
    
    CREATE INDEX IF NOT EXISTS idx_tracking_last_seen 
    ON active_tracking(last_seen);
`;

export const CLEANUP_QUERY = `
    DELETE FROM active_tracking 
    WHERE last_seen < datetime('now', '-2 hours');
`;