// components/tracking/map/components/EnhancedContextMapControls.tsx
import React from 'react';
import { useEnhancedMapContext } from '../../context/EnhancedMapContext';

const EnhancedContextMapControls: React.FC = () => {
  const { fullRefresh, isRefreshing, selectedManufacturer, trackingStatus } =
    useEnhancedMapContext();

  // Disable button if no manufacturer selected or refresh is in progress
  const isDisabled = !selectedManufacturer || isRefreshing;

  return (
    <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-2">
      <button
        onClick={() => fullRefresh()}
        disabled={isDisabled}
        className={`bg-green-500 text-white px-4 py-2 rounded shadow-md ${
          !isDisabled ? 'hover:bg-green-600' : 'opacity-50 cursor-not-allowed'
        }`}
      >
        Refresh Data
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
