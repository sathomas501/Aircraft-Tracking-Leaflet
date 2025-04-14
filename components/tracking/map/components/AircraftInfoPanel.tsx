// components/tracking/map/components/AircraftInfoPanel.tsx
import React, { useCallback } from 'react';
import { Aircraft } from '@/types/base';
import DraggablePanel from '../../DraggablePanel';
import { useAircraftTooltip } from '../../context/AircraftTooltipContext';
import { useEnhancedUI } from '../../context/EnhancedUIContext';
import type { ExtendedAircraft } from '@/types/base';
import AircraftPopupContent from './AircraftPopupContent';
import { useMap } from 'react-leaflet';

interface AircraftInfoPanelProps {
  aircraft: ExtendedAircraft;
}

// Enhanced determineAircraftType function with more specific type detection
export const determineAircraftType = (
  aircraft: Aircraft & {
    type?: string;
    TYPE_AIRCRAFT?: string;
    MODEL?: string;
  }
): string => {
  // Combine possible type fields for checking
  const typeString = [aircraft.type, aircraft.TYPE_AIRCRAFT, aircraft.MODEL]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Check for balloon (adding support for your aircraft_balloon.png)
  if (typeString.includes('balloon') || typeString.includes('airship')) {
    return 'balloon';
  }

  // Check for different helicopter/rotor types
  if (typeString.includes('helicopter') || typeString.includes('rotor')) {
    return 'helicopter';
  }

  // Check for different jet types
  if (typeString.includes('jet') || typeString.includes('airliner')) {
    return 'jet';
  }

  // Check for turboprop
  if (typeString.includes('turboprop') || typeString.includes('turbo prop')) {
    return 'turboprop';
  }

  // Check for twin engines
  if (typeString.includes('twin')) {
    return 'twinEngine';
  }

  // Check for single engine or piston aircraft
  if (typeString.includes('single') || typeString.includes('piston')) {
    return 'singleEngine';
  }

  // Manufacturer-based types
  if (typeString.includes('cessna')) {
    return typeString.includes('twin') ? 'twinEngine' : 'singleEngine';
  }

  if (typeString.includes('piper')) {
    return 'singleEngine';
  }

  if (typeString.includes('beech') || typeString.includes('beechcraft')) {
    return typeString.includes('king air') ? 'turboprop' : 'twinEngine';
  }

  if (typeString.includes('cirrus')) {
    return 'singleEngine';
  }

  if (typeString.includes('boeing') || typeString.includes('airbus')) {
    return 'jet';
  }

  if (typeString.includes('diamond')) {
    return 'singleEngine';
  }

  if (typeString.includes('mooney')) {
    return 'singleEngine';
  }

  if (typeString.includes('bombardier') || typeString.includes('embraer')) {
    return 'jet';
  }

  // Default to type based on basic inference
  if (typeString.includes('172') || typeString.includes('152')) {
    return 'singleEngine';
  }

  // Default to jet for unknown types
  return 'default';
};

// Get owner type CSS class
export const getOwnerTypeClass = (
  aircraft: Aircraft & {
    TYPE_REGISTRANT?: number;
    isGovernment?: boolean;
  }
): string => {
  const ownerType = aircraft.TYPE_REGISTRANT || aircraft.ownerType || 0;

  // If needed, ensure it's treated as a number for backward compatibility
  const ownerTypeNum =
    typeof ownerType === 'string' ? parseInt(ownerType, 10) : ownerType;

  // Rest of the function using ownerTypeNum

  // Map owner type to CSS class
  const ownerTypeMap: Record<number, string> = {
    1: 'Individual',
    2: 'Partnership',
    3: 'Corp-owner',
    4: 'Co-owned',
    7: 'LLC',
    8: 'non-citizen-corp-owned',
    9: 'Airline',
    10: 'Freight',
    11: 'Medical',
    12: 'Media',
    13: 'Historical',
    14: 'Flying Club',
    15: 'Emergency',
    16: 'Local Govt',
    17: 'Education',
    18: 'Federal Govt',
    19: 'Flight School',
    20: 'Leasing Corp',
  };

  // Default to 'unknown-owner' if type not found
  return ownerTypeMap[ownerType] || 'Owner Unkonwn';
};

const AircraftInfoPanel: React.FC<AircraftInfoPanelProps> = ({ aircraft }) => {
  const { visiblePopups, hidePopup } = useAircraftTooltip();
  const { selectAircraft, openPanel, closePanel, panels, isLoading } =
    useEnhancedUI();
  const map = useMap();

  // Check if this panel should be visible
  const aircraftId = aircraft.ICAO24 || '';
  const shouldShow = visiblePopups.has(aircraftId);

  // Get the aircraft data
  const popupAircraft = shouldShow
    ? visiblePopups.get(aircraftId) || aircraft
    : null;

  // If no panel should be shown, return null
  if (!shouldShow || !popupAircraft) {
    return null;
  }

  // Handle closing the panel
  const handleClose = useCallback(() => {
    hidePopup(aircraftId);
  }, [aircraftId, hidePopup]);

  // Handle selecting the aircraft
  const handleSelectAircraft = useCallback(
    (icao24: string) => {
      selectAircraft(popupAircraft);
    },
    [popupAircraft, selectAircraft]
  );

  // Calculate initial position - position it to the right of the aircraft
  const calculateInitialPosition = () => {
    if (!map || !aircraft.latitude || !aircraft.longitude) {
      return { x: 100, y: 100 };
    }

    try {
      // Convert aircraft position to screen coordinates
      const point = map.latLngToContainerPoint([
        aircraft.latitude,
        aircraft.longitude,
      ]);

      // Position panel to the right of the aircraft marker
      return {
        x: point.x + 30, // 30px to the right of the marker
        y: point.y - 100, // 100px above the marker
      };
    } catch (error) {
      console.error('Error calculating panel position:', error);
      return { x: 100, y: 100 };
    }
  };

  // Prevent map dragging when interacting with the panel
  const handleMouseDown = (e: React.MouseEvent) => {
    // Stop propagation to prevent the map from receiving the event
    e.stopPropagation();
  };

  // Create a modified version of AircraftPopupContent that doesn't show the name again
  const ModifiedContent = React.useMemo(() => {
    // Create a simple render function that wraps AircraftPopupContent
    // but passes a flag to indicate it's being rendered in a panel
    return (
      <div onMouseDown={handleMouseDown}>
        <AircraftPopupContent
          aircraft={popupAircraft}
          onSelectAircraft={handleSelectAircraft}
          onClose={handleClose}
          inPanel={true} // Pass flag to indicate it's in a panel
        />
      </div>
    );
  }, [popupAircraft, handleSelectAircraft, handleClose]);

  // Get aircraft type and owner type class
  const aircraftType = determineAircraftType(popupAircraft);
  const ownerTypeClass = getOwnerTypeClass(popupAircraft);

  // Get display name
  const displayName =
    popupAircraft.NAME ||
    (popupAircraft.OPERATOR ? popupAircraft.OPERATOR : null) ||
    popupAircraft.REGISTRATION ||
    popupAircraft.registration ||
    popupAircraft.ICAO24;

  // Get registration for secondary display
  const registration =
    popupAircraft.REGISTRATION ||
    popupAircraft.registration ||
    popupAircraft.N_NUMBER ||
    popupAircraft.ICAO24 ||
    'Unknown';

  console.log('Registration fields:', {
    REGISTRATION: aircraft.REGISTRATION,
    registration: aircraft.registration,
    N_NUMBER: aircraft.N_NUMBER,
    ICAO24: aircraft.ICAO24,
  });

  // Determine title - use NAME, OPERATOR, or registration
  const displayTitle =
    aircraft.NAME ||
    (aircraft.OPERATOR && aircraft.OPERATOR.includes('AIR')
      ? aircraft.OPERATOR
      : registration);

  // In AircraftInfoPanel.tsx - only change the children part:

  return (
    <DraggablePanel
      isOpen={shouldShow}
      onClose={handleClose}
      title={displayName} // Keep the title for accessibility
      initialPosition={calculateInitialPosition()}
      className={`aircraft-info-panel ${ownerTypeClass}`}
      headerClassName="aircraft-info-panel-header"
      maxWidth="280px"
      zIndex={9999}
    >
      {/* Add custom styled header */}
      <div className={`panel-custom-header ${aircraftType}-type`}>
        <div className="panel-title">{displayName}</div>
        {aircraft.NAME && <div className="panel-subtitle">{registration}</div>}
      </div>

      {/* Regular content */}
      <AircraftPopupContent
        aircraft={popupAircraft}
        onSelectAircraft={handleSelectAircraft}
        onClose={handleClose}
        inPanel={true}
      />
    </DraggablePanel>
  );
};

export default AircraftInfoPanel;
