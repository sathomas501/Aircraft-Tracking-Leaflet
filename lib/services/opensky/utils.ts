// lib/services/opensky/utils.ts
import type { Aircraft } from '@/types/base';
import type { PositionData } from '@/types/base';
import type {  OpenSkyAircraft } from '@/types/opensky';

export function positionToAircraft(position: PositionData): Aircraft {
    return {
        icao24: position.icao24,
        "N-NUMBER": "",
        manufacturer: "Unknown",
        model: "Unknown",
        operator: "Unknown",
        latitude: position.latitude,
        longitude: position.longitude,
        altitude: position.altitude || 0,  // Provide default value
        heading: position.heading || 0,    // Provide default value
        velocity: position.velocity || 0,  // Provide default value
        on_ground: position.on_ground,
        last_contact: position.last_contact,
        TYPE_AIRCRAFT: "",
        OWNER_TYPE: "",
        NAME: "",
        CITY: "",
        STATE: "",
        isTracked: true
    };
}

export function openSkyToAircraft(aircraft: OpenSkyAircraft): Aircraft {
    return {
        icao24: aircraft.icao24,
        "N-NUMBER": "",
        manufacturer: aircraft.manufacturer || "Unknown",
        model: aircraft.model || "Unknown",
        operator: "Unknown",
        latitude: aircraft.latitude ?? 0,    // Use nullish coalescing
        longitude: aircraft.longitude ?? 0,  // Use nullish coalescing
        altitude: aircraft.altitude ?? 0,    // Use nullish coalescing
        heading: aircraft.heading ?? 0,      // Use nullish coalescing
        velocity: aircraft.velocity ?? 0,    // Use nullish coalescing
        on_ground: aircraft.on_ground,
        last_contact: aircraft.last_contact,
        OWNER_TYPE: "",
        TYPE_AIRCRAFT: "",
        NAME: "",
        CITY: "",
        STATE: "",
        isTracked: true
    };
}