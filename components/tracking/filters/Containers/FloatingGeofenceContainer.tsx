// FloatingGeofenceContainer.tsx
import React from 'react';
import FloatingGeofencePanel from '../FloatingGeofencePanel';
import { useFilterLogic } from '../../hooks/useFilterLogicCompatible';

const FloatingGeofenceContainer: React.FC = () => {
  // Use our centralized filter logic
  const { state, actions, hasError } = useFilterLogic();

  // Extract geofence panel state
  const {
    show: showPanel,
    position: panelPosition,
    tempCoordinates,
    locationName,
    isLoading: isLoadingLocation,
  } = state.geofencePanel;

  // Extract geofence state
  const {
    active: isGeofenceActive,
    radius: geofenceRadius,
    location: geofenceLocation,
    coordinates: geofenceCoordinates,
    isGettingLocation,
  } = state.filters.geofence;

  // Get combined loading state
  const isSearching = state.ui.loading;

  return (
    <>
      {showPanel && panelPosition && (
        <FloatingGeofencePanel
          isOpen={showPanel}
          onClose={actions.closeGeofencePanel}
          geofenceRadius={geofenceRadius}
          setGeofenceRadius={(radius) =>
            actions.updateFilter('geofence', 'radius', radius)
          }
          processGeofenceSearch={() => actions.processGeofenceSearch(true)}
          isGeofenceActive={isGeofenceActive}
          geofenceLocation={geofenceCoordinates}
          isSearching={isSearching}
          coordinates={tempCoordinates}
          setCoordinates={(coords) =>
            actions.updateFilter('geofence', 'coordinates', coords)
          }
          locationName={locationName}
          isLoadingLocation={isLoadingLocation}
          panelPosition={panelPosition}
          setShowPanel={(show) => (show ? null : actions.closeGeofencePanel())}
          onSearch={(lat, lng) => actions.handlePanelSearch(lat, lng)}
          onReset={actions.resetGeofencePanel}
          flagUrl={null} // Optional: generate from locationName
          hasError={hasError}
        />
      )}
    </>
  );
};

export default FloatingGeofenceContainer;
