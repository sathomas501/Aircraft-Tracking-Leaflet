// lib/services/opensky-validation.ts
import type { OpenSkyState } from '@/types/api/opensky';
import { OPENSKY_INDICES } from '@/lib/api/constants';
import { OpenSkyError, OpenSkyErrorCode } from './opensky-errors';
import type {PositionData } from '@/types/base'

/**
 * Converts any value to a number or undefined if invalid
 */
export import { types } from 'util';
 function toNumberOrUndefined(value: any): number | undefined {
    if (value === null || value === undefined) return undefined;
    const num = Number(value);
    return isNaN(num) ? undefined : num;
}

/**
 * Validates and parses a raw state vector array into an OpenSkyState object
 */
export function validateStateVector(state: any[]): OpenSkyState {
    if (!Array.isArray(state) || state.length < 17) {
        throw new OpenSkyError(
            'Invalid state vector format',
            OpenSkyErrorCode.INVALID_DATA
        );
    }

    const parsedLastContact = Number(state[OPENSKY_INDICES.LAST_CONTACT]);
    if (isNaN(parsedLastContact)) {
        throw new OpenSkyError(
            `Invalid last_contact value: ${state[OPENSKY_INDICES.LAST_CONTACT]}`,
            OpenSkyErrorCode.INVALID_DATA
        );
    }

    return {
        icao24: String(state[OPENSKY_INDICES.ICAO24]),
        callsign: state[OPENSKY_INDICES.CALLSIGN] ? 
            String(state[OPENSKY_INDICES.CALLSIGN]) : undefined,
        origin_country: String(state[OPENSKY_INDICES.ORIGIN_COUNTRY]),
        time_position: toNumberOrUndefined(state[OPENSKY_INDICES.TIME_POSITION]),
        last_contact: parsedLastContact,
        longitude: toNumberOrUndefined(state[OPENSKY_INDICES.LONGITUDE]),
        latitude: toNumberOrUndefined(state[OPENSKY_INDICES.LATITUDE]),
        baro_altitude: toNumberOrUndefined(state[OPENSKY_INDICES.BARO_ALTITUDE]),
        on_ground: Boolean(state[OPENSKY_INDICES.ON_GROUND]),
        velocity: toNumberOrUndefined(state[OPENSKY_INDICES.VELOCITY]),
        true_track: toNumberOrUndefined(state[OPENSKY_INDICES.TRUE_TRACK]),
        vertical_rate: toNumberOrUndefined(state[OPENSKY_INDICES.VERTICAL_RATE]),
        sensors: Array.isArray(state[OPENSKY_INDICES.SENSORS]) ? 
            state[OPENSKY_INDICES.SENSORS].map(Number) : undefined,
        geo_altitude: toNumberOrUndefined(state[OPENSKY_INDICES.GEO_ALTITUDE]),
        squawk: state[OPENSKY_INDICES.SQUAWK] ? 
            String(state[OPENSKY_INDICES.SQUAWK]) : undefined,
        spi: Boolean(state[OPENSKY_INDICES.SPI]),
        position_source: Number(state[OPENSKY_INDICES.POSITION_SOURCE] || 0)
    };
}

/**
 * Maps an OpenSkyState object to a PositionData object
 */
export function mapStateToPosition(state: OpenSkyState): PositionData {
    return {
        icao24: state.icao24,
        latitude: state.latitude,
        longitude: state.longitude,
        altitude: state.baro_altitude,
        velocity: state.velocity,
        heading: state.true_track,
        on_ground: state.on_ground,
        last_contact: state.last_contact
    };
}

/**
 * Validates that a partial PositionData object contains all required fields
 * and that the values are within valid ranges
 */
export function validatePosition(position: Partial<PositionData>): position is PositionData {
    // Check required fields
    if (!position.icao24 || typeof position.icao24 !== 'string') {
        return false;
    }

    if (typeof position.on_ground !== 'boolean') {
        return false;
    }

    if (position.last_contact === undefined || 
        typeof position.last_contact !== 'number' ||
        isNaN(position.last_contact)) {
        return false;
    }

    // Check coordinate ranges if present
    if (position.latitude !== undefined && (
        typeof position.latitude !== 'number' ||
        isNaN(position.latitude) ||
        position.latitude < -90 ||
        position.latitude > 90
    )) {
        return false;
    }

    if (position.longitude !== undefined && (
        typeof position.longitude !== 'number' ||
        isNaN(position.longitude) ||
        position.longitude < -180 ||
        position.longitude > 180
    )) {
        return false;
    }

    // Optional numeric fields
    if (position.altitude !== undefined && (
        typeof position.altitude !== 'number' ||
        isNaN(position.altitude)
    )) {
        return false;
    }

    if (position.velocity !== undefined && (
        typeof position.velocity !== 'number' ||
        isNaN(position.velocity) ||
        position.velocity < 0
    )) {
        return false;
    }

    if (position.heading !== undefined && (
        typeof position.heading !== 'number' ||
        isNaN(position.heading) ||
        position.heading < 0 ||
        position.heading > 360
    )) {
        return false;
    }

    return true;
}