// components/tracking/utils/AircraftIcon.js
// This is a wrapper file to make imports easier

// Import the functions from your existing AircraftIcon.tsx
import {
  getIconSizeForZoom,
  getTooltipFontSize,
  createAircraftIcon,
  createTooltipContent,
  createPopupContent,
  getOwnerTypeLabel,
} from './AircraftIcon.tsx';

// Export all functions individually
export {
  getIconSizeForZoom,
  getTooltipFontSize,
  createAircraftIcon,
  createTooltipContent,
  createPopupContent,
  getOwnerTypeLabel,
};

// Also export as a default object for compatibility
export default {
  getIconSizeForZoom,
  getTooltipFontSize,
  createAircraftIcon,
  createTooltipContent,
  createPopupContent,
  getOwnerTypeLabel,
};
