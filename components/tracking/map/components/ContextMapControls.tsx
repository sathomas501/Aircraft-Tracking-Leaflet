// components/tracking/map/components/ContextMapControls.tsx
import React from 'react';
import { useMapContext } from '../../context/MapContext';

const ContextMapControls: React.FC = () => {
  const { refreshPositions, fullRefresh, isRefreshing } = useMapContext();

  return (
    <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-2">
      <button
        onClick={() => refreshPositions()}
        disabled={isRefreshing}
        className={`bg-blue-500 text-white px-4 py-2 rounded shadow-md ${
          !isRefreshing ? 'hover:bg-blue-600' : 'opacity-50 cursor-not-allowed'
        }`}
      >
        Update Positions
      </button>
      <button
        onClick={() => fullRefresh()}
        disabled={isRefreshing}
        className={`bg-green-500 text-white px-4 py-2 rounded shadow-md ${
          !isRefreshing ? 'hover:bg-green-600' : 'opacity-50 cursor-not-allowed'
        }`}
      >
        Full Refresh
      </button>

      {isRefreshing && (
        <div className="bg-white p-2 rounded shadow mt-2 text-sm">
          Refreshing aircraft data...
        </div>
      )}
    </div>
  );
};

export default ContextMapControls;
