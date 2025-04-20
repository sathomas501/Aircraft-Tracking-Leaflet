// components/tracking/map/components/ManualRefreshButton.tsx
import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface ManualRefreshButtonProps {
  onRefresh: () => Promise<void>;
  disabled?: boolean;
}

const ManualRefreshButton: React.FC<ManualRefreshButtonProps> = ({
  onRefresh,
  disabled = false,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing || disabled) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing || disabled}
      className={`px-3 py-2 rounded-md flex items-center gap-1 transition-colors ${
        isRefreshing || disabled
          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
          : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
      }`}
      title="Refresh Aircraft Data"
    >
      <RefreshCw
        size={16}
        className={`${isRefreshing ? 'animate-spin' : ''}`}
      />
      <span>Refresh</span>
    </button>
  );
};

export default ManualRefreshButton;
