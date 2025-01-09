// components/aircraft/tracking/Map/components/AircraftIcon/AircraftIcon.tsx
import L from 'leaflet';
import { Aircraft } from '@/types/base';
import { AIRCRAFT_MARKERS } from './constants';

interface IconOptions {
  isSelected?: boolean;
  highlightColor?: string;
}

export const createAircraftIcon = (
  aircraft: Aircraft, 
  options: IconOptions = {}
) => {
  const {
    isSelected = false,
    highlightColor = AIRCRAFT_MARKERS.COLORS.SELECTED
  } = options;

  const isGrounded = Boolean(aircraft.on_ground);
  const size = isSelected ? 
    AIRCRAFT_MARKERS.SIZE.SELECTED : 
    AIRCRAFT_MARKERS.SIZE.DEFAULT;
  
  const rotation = aircraft.heading;
  const opacity = isGrounded ? 
    AIRCRAFT_MARKERS.OPACITY.GROUNDED : 
    AIRCRAFT_MARKERS.OPACITY.ACTIVE;

  const markerStyles = [
    `transform: rotate(${rotation}deg)`,
    `width: ${size}px`,
    `height: ${size}px`,
    `transition: all ${AIRCRAFT_MARKERS.ANIMATION.DURATION}ms ease`,
    isSelected ? `filter: drop-shadow(0 0 4px ${highlightColor})` : ''
  ].filter(Boolean).join(';');

  const imageStyles = [
    'width: 100%',
    'height: 100%',
    `opacity: ${opacity}`,
    `transition: opacity ${AIRCRAFT_MARKERS.ANIMATION.DURATION}ms ease`
  ].join(';');

  const html = `
    <div 
      style="${markerStyles}"
      class="${cn(
        'aircraft-marker',
        isSelected && 'selected',
        isGrounded && 'grounded'
      )}"
      data-icao24="${aircraft.icao24}"
      data-n-number="${aircraft['N-NUMBER']}"
    >
      <img 
        src="${isGrounded ? '/aircraft-pin.png' : '/aircraft-pin-blue.png'}"
        style="${imageStyles}"
        alt="${aircraft.manufacturer} ${aircraft.model}"
        class="aircraft-icon-image"
      />
    </div>
  `;

  return L.divIcon({
    html,
    className: cn(
      'aircraft-icon',
      isSelected && 'selected',
      isGrounded && 'grounded',
      aircraft.isTracked && 'tracked'
    ),
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
    popupAnchor: [0, -size/2]
  });
};

const cn = (...classes: (string | boolean | undefined)[]) => {
  return classes.filter(Boolean).join(' ');
};