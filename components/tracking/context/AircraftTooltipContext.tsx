// components/tracking/context/AircraftTooltipContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { ExtendedAircraft } from '@/types/base';

// Define the context interface
interface AircraftTooltipContextType {
  // Tooltip state
  visibleTooltips: Map<string, ExtendedAircraft>; // Map of ICAO24 -> aircraft

  // Popup state
  visiblePopups: Map<string, ExtendedAircraft>; // Map of ICAO24 -> aircraft

  // Actions
  showTooltip: (aircraft: ExtendedAircraft) => void;
  hideTooltip: (icao24: string) => void;
  hideAllTooltips: () => void;
  showPopup: (aircraft: ExtendedAircraft) => void;
  hidePopup: (icao24: string) => void;
  hideAllPopups: () => void;

  // Styling options
  tooltipOffset: [number, number];
  setTooltipOffset: (offset: [number, number]) => void;

  // Utility
  isPermanentTooltip: boolean;
  setIsPermanentTooltip: (value: boolean) => void;
}

// Create the context
const AircraftTooltipContext = createContext<
  AircraftTooltipContextType | undefined
>(undefined);

// Provider component
export const AircraftTooltipProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // Tooltip state - use Maps keyed by ICAO24 to store active tooltips/popups
  const [visibleTooltips, setVisibleTooltips] = useState<
    Map<string, ExtendedAircraft>
  >(new Map());
  const [visiblePopups, setVisiblePopups] = useState<
    Map<string, ExtendedAircraft>
  >(new Map());

  // Styling options
  const [tooltipOffset, setTooltipOffset] = useState<[number, number]>([
    0, -20,
  ]);
  const [isPermanentTooltip, setIsPermanentTooltip] = useState(false);

  // Actions
  const showTooltip = (aircraft: ExtendedAircraft) => {
    if (!aircraft.ICAO24) return;

    setVisibleTooltips((prev) => {
      const newMap = new Map(prev);
      newMap.set(aircraft.ICAO24, aircraft);
      return newMap;
    });
  };

  const hideTooltip = (icao24: string) => {
    setVisibleTooltips((prev) => {
      const newMap = new Map(prev);
      newMap.delete(icao24);
      return newMap;
    });
  };

  const hideAllTooltips = () => {
    setVisibleTooltips(new Map());
  };

  const showPopup = (aircraft: ExtendedAircraft) => {
    if (!aircraft.ICAO24) return;

    setVisiblePopups((prev) => {
      const newMap = new Map(prev);
      newMap.set(aircraft.ICAO24, aircraft);
      return newMap;
    });
  };

  const hidePopup = (icao24: string) => {
    setVisiblePopups((prev) => {
      const newMap = new Map(prev);
      newMap.delete(icao24);
      return newMap;
    });
  };

  const hideAllPopups = () => {
    setVisiblePopups(new Map());
  };

  // Context value
  const value = {
    visibleTooltips,
    visiblePopups,
    showTooltip,
    hideTooltip,
    hideAllTooltips,
    showPopup,
    hidePopup,
    hideAllPopups,
    tooltipOffset,
    setTooltipOffset,
    isPermanentTooltip,
    setIsPermanentTooltip,
  };

  return (
    <AircraftTooltipContext.Provider value={value}>
      {children}
    </AircraftTooltipContext.Provider>
  );
};

// Custom hook for using the context
export const useAircraftTooltip = () => {
  const context = useContext(AircraftTooltipContext);

  if (context === undefined) {
    throw new Error(
      'useAircraftTooltip must be used within an AircraftTooltipProvider'
    );
  }

  return context;
};

export default AircraftTooltipContext;
