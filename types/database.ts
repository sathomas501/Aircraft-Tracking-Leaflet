// types/database.ts

/**
 * Aircraft status information for database operations
 */
export interface AircraftStatus {
    latitude?: number;
    longitude?: number;
    altitude?: number;
    velocity?: number;
    heading?: number;
    on_ground?: boolean;
    last_contact?: number;
    updated_at?: string;
<<<<<<< HEAD
    owner_type?: string;
    aircraft_type?: string;
=======
>>>>>>> 798df221367966fbfa340eee7bccf054863206c6
}

/**
 * Database operation result type
 */
export interface DatabaseResult {
    changes?: number;
    lastID?: number;
}

/**
 * Database error with SQLite specific fields
 */
export interface DatabaseError extends Error {
    code?: string;
    errno?: number;
}

/**
 * Aircraft database record
 */
export interface AircraftRecord {
    icao24: string;
    "N-NUMBER": string;
    manufacturer: string;
    model?: string;
    operator?: string;
    NAME: string;
    CITY: string;
    STATE: string;
<<<<<<< HEAD
    owner_type?: string;
    aircraft_type?: string;
=======
    TYPE_AIRCRAFT?: string;
>>>>>>> 798df221367966fbfa340eee7bccf054863206c6
    created_at?: string;
    is_active?: boolean;
}

/**
 * Active aircraft database record
 */
export interface ActiveAircraftRecord extends AircraftStatus {
    icao24: string;
    manufacturer: string;
    model?: string;
    is_active: boolean;
    // updated_at is inherited from AircraftStatus as string | undefined
}

/**
 * Database query parameters
 */
export interface QueryParams {
    manufacturer?: string;
    model?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
}

