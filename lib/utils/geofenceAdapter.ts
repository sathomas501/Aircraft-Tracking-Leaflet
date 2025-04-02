// lib/utils/geofenceAdapter.ts
import {
  BaseTransforms,
  OpenSkyTransforms,
} from '../../utils/aircraft-transform1';
import type { ExtendedAircraft, Aircraft } from '../../types/base';

/**
 * Adapts aircraft data from geofencing to be compatible with the main system
 *
 * @param geofenceAircraft The aircraft array from geofencing
 * @returns ExtendedAircraft[] compatible with your system
 */
export function adaptGeofenceAircraft(
  geofenceAircraft: any[]
): ExtendedAircraft[] {
  console.log(
    `[GeofenceAdapter] Adapting ${geofenceAircraft.length} aircraft from geofence`
  );

  // Debug the first aircraft if available
  if (geofenceAircraft.length > 0) {
    console.log(
      '[GeofenceAdapter] Sample raw aircraft data:',
      Object.keys(geofenceAircraft[0]).reduce(
        (acc, key) => {
          // Only include non-objects for clarity
          const value = geofenceAircraft[0][key];
          if (typeof value !== 'object' || value === null) {
            acc[key] = value;
          }
          return acc;
        },
        {} as Record<string, any>
      )
    );
  }

  const adapted = geofenceAircraft.map((aircraft) => {
    // First, normalize to base Aircraft type using your existing utilities
    const baseAircraft = BaseTransforms.normalize({
      // Required core fields
      ICAO24: aircraft.ICAO24 || '',

      // Map coordinates - handle both formats
      latitude: aircraft.latitude || aircraft.lat || 0,
      longitude: aircraft.longitude || aircraft.lng || 0,

      // Flight data
      altitude:
        aircraft.altitude ||
        aircraft.baro_altitude ||
        aircraft.geo_altitude ||
        0,
      heading: aircraft.heading || aircraft.true_track || 0,
      velocity: aircraft.velocity || 0,

      // Status
      on_ground: OpenSkyTransforms.convertToBoolean(
        aircraft.on_ground || aircraft.isOnGround || aircraft.onGround
      ),

      // Timestamps
      last_contact:
        aircraft.last_contact ||
        aircraft.lastContact ||
        Math.floor(Date.now() / 1000),
      lastSeen: aircraft.lastSeen || Date.now(),

      // Aircraft information
      N_NUMBER: aircraft['N_NUMBER'] || aircraft.registration || '',
      MANUFACTURER:
        aircraft.MANUFACTURER || aircraft.manufacturerName || 'Unknown',
      MODEL: aircraft.MODEL || aircraft.type_aircraft || '',
      operator: aircraft.operator || '',
      NAME: aircraft.NAME || aircraft.name || '',
      CITY: aircraft.CITY || aircraft.city || '',
      STATE: aircraft.STATE || aircraft.state || '',
      AIRCRAFT_TYPE:
        aircraft.AIRCRAFT_TYPE ||
        aircraft.type_aircraft ||
        aircraft.type ||
        'Unknown',
      OWNER_TYPE: aircraft.OWNER_TYPE || aircraft.ownerType || '0',

      // Flags
      isTracked: true,
    });

    // Then cast to ExtendedAircraft with the required properties
    const extendedAircraft = baseAircraft as unknown as ExtendedAircraft;

    // Add the required properties for ExtendedAircraft
    extendedAircraft.type = determineAircraftType(baseAircraft);
    extendedAircraft.isGovernment =
      baseAircraft.OWNER_TYPE === 'Government' ||
      baseAircraft.OWNER_TYPE === '5';

    // Make sure marker field exists - critical for rendering
    extendedAircraft.marker = 'default';

    // Ensure these properties exist (used in createAircraftIcon)
    if (typeof extendedAircraft.heading !== 'number')
      extendedAircraft.heading = 0;
    if (typeof extendedAircraft.on_ground !== 'boolean')
      extendedAircraft.on_ground = false;

    return extendedAircraft;
  });

  // Debug the first adapted aircraft if available
  if (adapted.length > 0) {
    console.log('[GeofenceAdapter] First aircraft after adaptation:', {
      ICAO24: adapted[0].ICAO24,
      latitude: adapted[0].latitude,
      longitude: adapted[0].longitude,
      heading: adapted[0].heading,
      type: adapted[0].type,
      isGovernment: adapted[0].isGovernment,
      marker: adapted[0].marker,
      on_ground: adapted[0].on_ground,
      isTracked: adapted[0].isTracked,
    });
  }

  return adapted;
}

/**
 * Determines aircraft type based on available information
 */
function determineAircraftType(aircraft: Aircraft): string {
  // Check if it mentions helicopter in various fields
  const possibleHelicopterFields = ['AIRCRAFT_TYPE', 'MODEL', 'MANUFACTURER'];

  for (const field of possibleHelicopterFields) {
    const value = aircraft[field as keyof Aircraft];
    if (
      typeof value === 'string' &&
      (value.toLowerCase().includes('helicopter') ||
        value.toLowerCase().includes('helo') ||
        value.toLowerCase().includes('rotor'))
    ) {
      return 'helicopter';
    }
  }

  // Default to plane
  return 'plane';
}
