// lib/services/opensky-validation.ts
import type { OpenSkyState } from '@/types/api/opensky';
import { PARSER_CONSTANTS } from '../../constants/parsers';
import { OpenSkyError, OpenSkyErrorCode } from '@/lib/services/error-handler';
import type {PositionData } from '@/types/base'

/**
 * Converts any value to a number or undefined if invalid
 */
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

    const parsedLastContact = Number(state[PARSER_CONSTANTS.INDICES.LAST_CONTACT]);
    if (isNaN(parsedLastContact)) {
        throw new OpenSkyError(
            `Invalid last_contact value: ${state[PARSER_CONSTANTS.INDICES.LAST_CONTACT]}`,
            OpenSkyErrorCode.INVALID_DATA
        );
    }

    return {
        icao24: String(state[PARSER_CONSTANTS.INDICES.ICAO24]),
        callsign: state[PARSER_CONSTANTS.INDICES.CALLSIGN] ? 
            String(state[PARSER_CONSTANTS.INDICES.CALLSIGN]) : undefined,
        origin_country: String(state[PARSER_CONSTANTS.INDICES.ORIGIN_COUNTRY]),
        time_position: toNumberOrUndefined(state[PARSER_CONSTANTS.INDICES.TIME_POSITION]),
        last_contact: parsedLastContact,
        longitude: toNumberOrUndefined(state[PARSER_CONSTANTS.INDICES.LONGITUDE]),
        latitude: toNumberOrUndefined(state[PARSER_CONSTANTS.INDICES.LATITUDE]),
        baro_altitude: toNumberOrUndefined(state[PARSER_CONSTANTS.INDICES.BARO_ALTITUDE]),
        on_ground: Boolean(state[PARSER_CONSTANTS.INDICES.ON_GROUND]),
        velocity: toNumberOrUndefined(state[PARSER_CONSTANTS.INDICES.VELOCITY]),
        true_track: toNumberOrUndefined(state[PARSER_CONSTANTS.INDICES.TRUE_TRACK]),
        vertical_rate: toNumberOrUndefined(state[PARSER_CONSTANTS.INDICES.VERTICAL_RATE]),
        sensors: Array.isArray(state[PARSER_CONSTANTS.INDICES.SENSORS]) ? 
            state[PARSER_CONSTANTS.INDICES.SENSORS].map(Number) : undefined,
        geo_altitude: toNumberOrUndefined(state[PARSER_CONSTANTS.INDICES.GEO_ALTITUDE]),
        squawk: state[PARSER_CONSTANTS.INDICES.SQUAWK] ? 
            String(state[PARSER_CONSTANTS.INDICES.SQUAWK]) : undefined,
        spi: Boolean(state[PARSER_CONSTANTS.INDICES.SPI]),
        position_source: Number(state[PARSER_CONSTANTS.INDICES.POSITION_SOURCE] || 0)
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