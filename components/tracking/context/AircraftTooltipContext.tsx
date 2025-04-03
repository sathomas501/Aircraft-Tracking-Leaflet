// components/tracking/context/AircraftTooltipContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { ExtendedAircraft } from '@/types/base';

// Define the context interface
interface AircraftTooltipContextType {
  // Tooltip state
  isTooltipVisible: boolean;
  tooltipAircraft: ExtendedAircraft | null;

  // Popup state
  isPopupVisible: boolean;
  popupAircraft: ExtendedAircraft | null;

  // Actions
  showTooltip: (aircraft: ExtendedAircraft) => void;
  hideTooltip: () => void;
  showPopup: (aircraft: ExtendedAircraft) => void;
  hidePopup: () => void;

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
  // Tooltip state
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [tooltipAircraft, setTooltipAircraft] =
    useState<ExtendedAircraft | null>(null);

  // Popup state
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [popupAircraft, setPopupAircraft] = useState<ExtendedAircraft | null>(
    null
  );

  // Styling options
  const [tooltipOffset, setTooltipOffset] = useState<[number, number]>([
    0, -20,
  ]);
  const [isPermanentTooltip, setIsPermanentTooltip] = useState(false);

  // Actions
  const showTooltip = (aircraft: ExtendedAircraft) => {
    setTooltipAircraft(aircraft);
    setIsTooltipVisible(true);
  };

  const hideTooltip = () => {
    setIsTooltipVisible(false);
  };

  const showPopup = (aircraft: ExtendedAircraft) => {
    setPopupAircraft(aircraft);
    setIsPopupVisible(true);
  };

  const hidePopup = () => {
    setIsPopupVisible(false);
  };

  // Context value
  const value = {
    isTooltipVisible,
    tooltipAircraft,
    isPopupVisible,
    popupAircraft,
    showTooltip,
    hideTooltip,
    showPopup,
    hidePopup,
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
