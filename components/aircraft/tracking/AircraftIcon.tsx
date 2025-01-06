// components/Maps/AircraftIcon.tsx
import L from 'leaflet';
import { Aircraft, Position } from '@/types/types';

// Constants for aircraft markers
const AIRCRAFT_MARKERS = {
  SIZE: {
    SELECTED: 32,
    DEFAULT: 24
  },
  COLORS: {
    SELECTED: '#2563eb',
    DEFAULT: '#4b5563'
  },
  OPACITY: {
    GROUNDED: 0.7,
    ACTIVE: 1
  },
  ANIMATION: {
    DURATION: 300
  }
} as const;

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
  
  // Use true_track for rotation (it's non-optional in your interface)
  const rotation = aircraft.true_track;

  // Determine opacity based on status
  const opacity = isGrounded ? 
    AIRCRAFT_MARKERS.OPACITY.GROUNDED : 
    AIRCRAFT_MARKERS.OPACITY.ACTIVE;

  // Create marker styles
  const markerStyles = [
    `transform: rotate(${rotation}deg)`,
    `width: ${size}px`,
    `height: ${size}px`,
    `transition: all ${AIRCRAFT_MARKERS.ANIMATION.DURATION}ms ease`,
    isSelected ? `filter: drop-shadow(0 0 4px ${highlightColor})` : ''
  ].filter(Boolean).join(';');

  // Create image styles
  const imageStyles = [
    'width: 100%',
    'height: 100%',
    `opacity: ${opacity}`,
    `transition: opacity ${AIRCRAFT_MARKERS.ANIMATION.DURATION}ms ease`
  ].join(';');

  // Create HTML content
  const html = `
    <div 
      style="${markerStyles}"
      class="aircraft-marker ${isSelected ? 'selected' : ''} ${isGrounded ? 'grounded' : ''}"
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

  return new L.DivIcon({
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

// Helper function to combine class names with proper typing
const cn = (...classes: (string | boolean | undefined)[]) => {
  return classes.filter(Boolean).join(' ');
};