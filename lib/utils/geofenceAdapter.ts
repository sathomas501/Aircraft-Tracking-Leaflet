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

  return geofenceAircraft.map((aircraft) => {
    // First, normalize to base Aircraft type using your existing utilities
    const baseAircraft = BaseTransforms.normalize({
      // Required core fields
      icao24: aircraft.icao24 || '',

      // Map coordinates - handle both formats
      latitude: aircraft.latitude || aircraft.lat || 0,
      longitude: aircraft.longitude || aircraft.lng || 0,

      // Flight data
      altitude: aircraft.altitude || 0,
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
      'N-NUMBER': aircraft['N-NUMBER'] || '',
      manufacturer:
        aircraft.manufacturer || aircraft.manufacturerName || 'Unknown',
      model: aircraft.model || '',
      NAME: aircraft.NAME || aircraft.name || '',
      CITY: aircraft.CITY || aircraft.city || '',
      STATE: aircraft.STATE || aircraft.state || '',
      TYPE_AIRCRAFT:
        aircraft.TYPE_AIRCRAFT ||
        aircraft.type_aircraft ||
        aircraft.type ||
        'Unknown',
      OWNER_TYPE: aircraft.OWNER_TYPE || aircraft.ownerType || '',

      // Flags
      isTracked: true,
    });

    // Then cast to ExtendedAircraft with the required properties
    const extendedAircraft = baseAircraft as ExtendedAircraft;

    // Add the required properties for ExtendedAircraft
    extendedAircraft.type = baseAircraft.TYPE_AIRCRAFT;
    extendedAircraft.isGovernment = baseAircraft.OWNER_TYPE === 'Government';

    return extendedAircraft;
  });
}
