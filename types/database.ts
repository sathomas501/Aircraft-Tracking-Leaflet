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
  owner_type?: string;
  aircraft_type?: string;
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
  ICAO24: string;
  N_NUMBER: string;
  MANUFACTURER: string;
  MODEL?: string;
  operator?: string;
  NAME: string;
  CITY: string;
  STATE: string;
  owner_type?: string;
  aircraft_type?: string;
  created_at?: string;
  is_active?: boolean;
}

/**
 * Active aircraft database record
 */
export interface ActiveAircraftRecord extends AircraftStatus {
  ICAO24: string;
  MANUFACTURER: string;
  MODEL?: string;
  is_active: boolean;
  // updated_at is inherited from AircraftStatus as string | undefined
}

/**
 * Database query parameters
 */
export interface QueryParams {
  MANUFACTURER?: string;
  MODEL?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}
