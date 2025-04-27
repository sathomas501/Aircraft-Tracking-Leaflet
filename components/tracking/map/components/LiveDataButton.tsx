// LiveDataButton.tsx - Button to fetch live position data
import React from 'react';
import { RefreshCw } from 'lucide-react';

interface LiveDataButtonProps {
  onClick: () => void;
  loading: boolean;
  disabled?: boolean;
  showLiveData: boolean;
}

const LiveDataButton: React.FC<LiveDataButtonProps> = ({
  onClick,
  loading,
  disabled = false,
  showLiveData,
}) => {
  return (
    <button
      className={`px-4 py-2 rounded-md flex items-center ${
        loading ? 'opacity-70 cursor-not-allowed' : ''
      } ${
        showLiveData
          ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
          : 'bg-indigo-600 text-white hover:bg-indigo-700'
      }`}
      onClick={onClick}
      disabled={loading || disabled}
    >
      <RefreshCw
        size={16}
        className={`mr-2 ${loading ? 'animate-spin' : ''}`}
      />
      {showLiveData ? 'Refresh Live Data' : 'View Live Positions'}
    </button>
  );
};

export default LiveDataButton;
