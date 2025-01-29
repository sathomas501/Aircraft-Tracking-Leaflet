// components/aircraft/tracking/Map/components/AircraftIcon/AircraftIcon.tsx
import L from 'leaflet';
import { Aircraft } from '@/types/base';
import { AIRCRAFT_MARKERS } from './constants';
import clsx from 'clsx';

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
  
  // Use heading directly since PNG is oriented north (0 degrees)
  const rotation = (aircraft.heading || 0) % 360;
  
  const opacity = isGrounded ? 
    AIRCRAFT_MARKERS.OPACITY.GROUNDED : 
    AIRCRAFT_MARKERS.OPACITY.ACTIVE;

  const color = isSelected ? 
    AIRCRAFT_MARKERS.COLORS.SELECTED : 
    AIRCRAFT_MARKERS.COLORS.DEFAULT;

  const containerStyles = [
    `width: ${size}px`,
    `height: ${size}px`,
    `transition: all ${AIRCRAFT_MARKERS.ANIMATION.DURATION}ms ease`,
    isSelected ? `filter: drop-shadow(0 0 4px ${color})` : ''
  ].filter(Boolean).join(';');

  const imageStyles = [
    'width: 100%',
    'height: 100%',
    'transform-origin: center',
    `transform: rotate(${rotation}deg)`,
    `opacity: ${opacity}`,
    'transition: all 300ms ease'
  ].join(';');

  const html = `
    <div 
      style="${containerStyles}"
      class="${clsx(
        'aircraft-marker',
        isSelected && 'selected',
        isGrounded && 'grounded'
      )}"
      data-icao24="${aircraft.icao24}"
      data-n-number="${aircraft['N-NUMBER']}"
    >
      <img 
        src="${isGrounded ? '/icons/aircraft-pin-grounded.png' : '/icons/aircraft-pin-active.png'}"
        style="${imageStyles}"
        alt="${aircraft.manufacturer} ${aircraft.model || 'aircraft'}"
        class="aircraft-icon-image"
      />
    </div>
  `;

  return L.divIcon({
    html,
    className: clsx(
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