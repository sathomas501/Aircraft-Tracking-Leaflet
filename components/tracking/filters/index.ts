// components/tracking/filters/index.ts

// Export components
export { default as GeofenceFilterComponent } from './GeofenceFilterComponent';
export { default as GeofenceFilterContainer } from './Containers/GeofenceFilterContainer';
export { default as FloatingGeofencePanelComponent } from '../filters/FloatingGeofencePanel';
export { default as FloatingGeofencePanelContainer } from './Containers/FloatingGeofenceContainer';
// Export types
export type {
  GeofenceFilterComponentProps
} from './GeofenceFilterComponent';

// Export coordinate types for reuse
export interface Coordinates {
  lat: number;
  lng: number;
}

export interface PanelPosition {
  x: number;
  y: number;
}