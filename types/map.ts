// types/map.ts
import type { LatLngTuple, LatLngBoundsExpression } from 'leaflet';

export interface MapConfig {
  center: LatLngTuple;
  zoom: number;
  bounds?: LatLngBoundsExpression;
  minZoom?: number;
  maxZoom?: number;
}

export interface MapProps {
  config?: Partial<MapConfig>;
  className?: string;
}

export interface MapControlsProps {
  position?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onReset?: () => void;
}

export interface MapProps extends Partial<MapConfig> {
  className?: string;
}