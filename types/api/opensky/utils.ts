// types/api/opensky/utils.ts
import type { Aircraft, PositionData, AircraftPosition } from '../../base';
import type { OpenSkyState } from './interfaces';

export class OpenSkyError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'OpenSkyError';
  }
}

export const OpenSkyUtils = {
  stateToPosition(state: OpenSkyState): AircraftPosition | null {
    if (!state.latitude || !state.longitude) return null;

    return {
      lat: state.latitude,
      lng: state.longitude,
      altitude: state.baro_altitude ?? state.geo_altitude,
      heading: state.true_track,
      velocity: state.velocity,
      on_ground: state.on_ground
    };
  },

  hasValidPosition(state: OpenSkyState): boolean {
    return (
      typeof state.latitude === 'number' &&
      typeof state.longitude === 'number' &&
      !isNaN(state.latitude) &&
      !isNaN(state.longitude)
    );
  },

  mergeWithAircraft(state: OpenSkyState, aircraft: Partial<Aircraft>): Aircraft {
    const currentTime = Math.floor(Date.now() / 1000);
    return {
      icao24: state.icao24,
      latitude: state.latitude ?? 0,
      longitude: state.longitude ?? 0,
      altitude: state.baro_altitude ?? state.geo_altitude ?? 0,
      heading: state.true_track ?? 0,
      velocity: state.velocity ?? 0,
      on_ground: Boolean(state.on_ground),
      last_contact: state.last_contact ?? currentTime,
      "N-NUMBER": aircraft["N-NUMBER"] ?? "",
      manufacturer: aircraft.manufacturer ?? "",
      model: aircraft.model ?? "",
      operator: aircraft.operator ?? "",
<<<<<<< HEAD
      OWNER_TYPE: aircraft.OWNER_TYPE ?? "",
      TYPE_AIRCRAFT: aircraft.TYPE_AIRCRAFT ?? "",
=======
>>>>>>> 798df221367966fbfa340eee7bccf054863206c6
      NAME: aircraft.NAME ?? "",
      CITY: aircraft.CITY ?? "",
      STATE: aircraft.STATE ?? "",
      isTracked: aircraft.isTracked ?? false
    };
  }
};

export function isOpenSkyState(value: unknown): value is OpenSkyState {
  return (
    typeof value === 'object' &&
    value !== null &&
    'icao24' in value &&
    typeof (value as OpenSkyState).icao24 === 'string' &&
    'last_contact' in value &&
    typeof (value as OpenSkyState).last_contact === 'number' &&
    'on_ground' in value &&
    typeof (value as OpenSkyState).on_ground === 'boolean'
  );
}

export function isValidPositionData(data: unknown): data is PositionData {
  return (
    data !== null &&
    typeof data === 'object' &&
    'icao24' in data &&
    typeof (data as PositionData).icao24 === 'string' &&
    'latitude' in data &&
    typeof (data as PositionData).latitude === 'number' &&
    'longitude' in data &&
    typeof (data as PositionData).longitude === 'number' &&
    'on_ground' in data &&
    typeof (data as PositionData).on_ground === 'boolean' &&
    'last_contact' in data &&
    typeof (data as PositionData).last_contact === 'number' &&
    !isNaN((data as PositionData).latitude) &&
    !isNaN((data as PositionData).longitude) &&
    !isNaN((data as PositionData).last_contact) &&
    (data as PositionData).latitude >= -90 &&
    (data as PositionData).latitude <= 90 &&
    (data as PositionData).longitude >= -180 &&
    (data as PositionData).longitude <= 180
  );
}

export function parsePositionData(rawData: unknown[]): PositionData | null {
  if (!Array.isArray(rawData) || rawData.length < 17) return null;

  const [
    icao24,
    _callsign,
    _origin_country,
    _time_position,
    last_contact,
    longitude,
    latitude,
    _baro_altitude,
    on_ground,
    velocity,
    heading,
    _vertical_rate,
    _sensors,
    altitude,
  ] = rawData;

  if (
    typeof icao24 !== 'string' ||
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    isNaN(latitude) ||
    isNaN(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return {
    icao24,
    latitude,
    longitude,
    altitude: typeof altitude === 'number' && !isNaN(altitude) ? altitude : 0,
    velocity: typeof velocity === 'number' && !isNaN(velocity) ? velocity : 0,
    heading: typeof heading === 'number' && !isNaN(heading) ? heading : 0,
    on_ground: Boolean(on_ground),
    last_contact: Math.floor(Number(last_contact) || Date.now() / 1000)
  };
}