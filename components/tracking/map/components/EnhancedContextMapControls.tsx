// components/tracking/map/components/EnhancedContextMapControls.tsx
import React from 'react';
import { useEnhancedMapContext } from '../../context/EnhancedMapContext';

const EnhancedContextMapControls: React.FC = () => {
  const {
    refreshPositions,
    fullRefresh,
    isRefreshing,
    selectedManufacturer,
    trackingStatus,
  } = useEnhancedMapContext();

  // Disable buttons if no manufacturer selected or refresh is in progress
  const isDisabled = !selectedManufacturer || isRefreshing;

  return (
    <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-2">
      <button
        onClick={() => refreshPositions()}
        disabled={isDisabled}
        className={`bg-blue-500 text-white px-4 py-2 rounded shadow-md ${
          !isDisabled ? 'hover:bg-blue-600' : 'opacity-50 cursor-not-allowed'
        }`}
      >
        Update Positions
      </button>
      <button
        onClick={() => fullRefresh()}
        disabled={isDisabled}
        className={`bg-green-500 text-white px-4 py-2 rounded shadow-md ${
          !isDisabled ? 'hover:bg-green-600' : 'opacity-50 cursor-not-allowed'
        }`}
      >
        Full Refresh
      </button>

      {/* Status indicator */}
      {(isRefreshing || trackingStatus) && (
        <div className="bg-white p-2 rounded shadow mt-2 text-sm">
          {isRefreshing ? 'Refreshing aircraft data...' : trackingStatus}
        </div>
      )}
    </div>
  );
};

export default EnhancedContextMapControls;
