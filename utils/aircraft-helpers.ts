// utils/aircraft-helpers.ts
import type { Aircraft, PositionData } from '@/types/base';

export function normalizeAircraft(partialAircraft: Partial<Aircraft>): Aircraft {
    const currentTime = Math.floor(Date.now() / 1000);
    
    return {
        // Required fields with defaults
        icao24: partialAircraft.icao24 || '',
        "N-NUMBER": partialAircraft["N-NUMBER"] || "Unknown",
        manufacturer: partialAircraft.manufacturer || "Unknown",
        latitude: partialAircraft.latitude || 0,
        longitude: partialAircraft.longitude || 0,
        altitude: partialAircraft.altitude || 0,
        heading: partialAircraft.heading || 0,
        velocity: partialAircraft.velocity || 0,
        on_ground: partialAircraft.on_ground || false,
        last_contact: partialAircraft.last_contact || currentTime,
        NAME: partialAircraft.NAME || "Unknown",
        CITY: partialAircraft.CITY || "Unknown",
        STATE: partialAircraft.STATE || "Unknown",
        TYPE_AIRCRAFT: partialAircraft.TYPE_AIRCRAFT || "Unknown",
        OWNER_TYPE: partialAircraft.OWNER_TYPE || "Unknown",
        isTracked: partialAircraft.isTracked || false,

        // Optional fields
        model: partialAircraft.model,
        operator: partialAircraft.operator,
        lastSeen: partialAircraft.lastSeen,
        registration: partialAircraft.registration,
        manufacturerName: partialAircraft.manufacturerName,
        owner: partialAircraft.owner,
        registered: partialAircraft.registered,
        manufacturerIcao: partialAircraft.manufacturerIcao,
        operatorIcao: partialAircraft.operatorIcao,
        active: partialAircraft.active
    };
}

export function positionDataToAircraft(posData: PositionData): Aircraft {
    return normalizeAircraft({
        icao24: posData.icao24,
        latitude: posData.latitude,
        longitude: posData.longitude,
        altitude: posData.altitude,
        heading: posData.heading,
        velocity: posData.velocity,
        on_ground: posData.on_ground,
        last_contact: posData.last_contact,
        isTracked: true,
        // Add required fields with defaults
        "N-NUMBER": "Unknown",
        manufacturer: "Unknown",
        NAME: "Unknown",
        CITY: "Unknown",
        STATE: "Unknown",
        TYPE_AIRCRAFT: "Unknown",
        OWNER_TYPE: "Unknown"
    });
}