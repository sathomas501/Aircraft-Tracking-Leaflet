import { PositionData, Aircraft } from '@/types/base';

export const mapPositionDataToAircraft = (position: PositionData): Aircraft => ({
  icao24: position.icao24 || '', // Default to empty string if undefined
  latitude: position.latitude ?? 0, // Default to 0 if undefined
  longitude: position.longitude ?? 0,
  velocity: position.velocity ?? 0,
  heading: position.heading ?? 0,
  altitude: position.altitude ?? 0,
  on_ground: position.on_ground ?? false,
  last_contact: position.last_contact ?? 0,
  "N-NUMBER": '', // Default empty string for Aircraft-specific fields
  manufacturer: '',
  model: '',
  operator: '',
  OWNER_TYPE: '',
  TYPE_AIRCRAFT: '',
  NAME: '',
  CITY: '',
  STATE: '',
  isTracked: true,
});
