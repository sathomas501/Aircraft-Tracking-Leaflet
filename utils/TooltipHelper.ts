// TooltipHelper.ts - Add this to your project
// This utility helps apply owner type styling to Leaflet tooltips

import React, { useEffect, RefObject } from 'react';
import L from 'leaflet';
import { ExtendedAircraft } from '@/types/base';

/**
 * Helper function to apply owner type classes to Leaflet tooltip elements
 * This handles the direct DOM manipulation needed to style Leaflet tooltips
 */
export const applyOwnerTypeStylingToTooltip = (
  tooltipRef: RefObject<L.Tooltip>,
  aircraft: ExtendedAircraft
): void => {
  if (!tooltipRef.current) return;

  // Get the DOM element
  const tooltipElement = tooltipRef.current.getElement();
  if (!tooltipElement) return;

  // Get the owner type class
  const ownerType = aircraft.OWNER_TYPE || '';
  let ownerTypeClass = 'unknown-owner';

  // Map owner type to CSS class
  const ownerTypeMap: Record<string, string> = {
    '1': 'Individual',
    '2': 'Partnership',
    '3': 'Corp-owner',
    '4': 'Co-owned',
    '5': 'Government',
    '7': 'LLC',
    '8': 'non-citizen-corp-owned',
    '9': 'Airline',
    '10': 'Freight',
    '11': 'Medical',
    '12': 'Media',
    '13': 'Historical',
    '14': 'Flying-Club',
    '15': 'Emergency',
    '16': 'Local-Govt',
    '17': 'Education',
    '18': 'Federal-Govt',
    '19': 'Flight-School',
    '20': 'Leasing-Corp',
  };

  // Get the proper class
  ownerTypeClass = ownerTypeMap[ownerType] || 'unknown-owner';

  // Remove any existing owner type classes
  tooltipElement.classList.forEach((cls) => {
    if (cls.startsWith('owner-') || cls.endsWith('-owner')) {
      tooltipElement.classList.remove(cls);
    }
  });

  // Add both owner-Class and Class-owner formats for compatibility
  tooltipElement.classList.add(`owner-${ownerTypeClass}`);
  tooltipElement.classList.add(`${ownerTypeClass}-owner`);

  // Force a repaint to ensure styles are applied
  requestAnimationFrame(() => {
    tooltipElement.style.opacity = '0.99';
    setTimeout(() => {
      tooltipElement.style.opacity = '1';
    }, 10);
  });
};

/**
 * Custom React hook for applying tooltip styling
 * Use this in your marker components to automatically apply styling
 */
export const useTooltipStyling = (
  tooltipRef: RefObject<L.Tooltip>,
  aircraft: ExtendedAircraft,
  isVisible: boolean
): void => {
  useEffect(() => {
    if (isVisible && tooltipRef.current) {
      applyOwnerTypeStylingToTooltip(tooltipRef, aircraft);
    }
  }, [tooltipRef.current, aircraft.OWNER_TYPE, isVisible]);
};

/**
 * Get CSS class for owner type (for use in React component class names)
 */
export const getOwnerTypeClassName = (aircraft: ExtendedAircraft): string => {
  const ownerType = aircraft.OWNER_TYPE || '';

  // Map owner type to CSS class
  const ownerTypeMap: Record<string, string> = {
    '1': 'Individual',
    '2': 'Partnership',
    '3': 'Corp-owner',
    '4': 'Co-owned',
    '5': 'Government',
    '7': 'LLC',
    '8': 'non-citizen-corp-owned',
    '9': 'Airline',
    '10': 'Freight',
    '11': 'Medical',
    '12': 'Media',
    '13': 'Historical',
    '14': 'Flying-Club',
    '15': 'Emergency',
    '16': 'Local-Govt',
    '17': 'Education',
    '18': 'Federal-Govt',
    '19': 'Flight-School',
    '20': 'Leasing-Corp',
  };

  return ownerTypeMap[ownerType] || 'unknown-owner';
};

export default {
  applyOwnerTypeStylingToTooltip,
  useTooltipStyling,
  getOwnerTypeClassName,
};
