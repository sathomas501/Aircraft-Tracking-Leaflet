// components/tracking/map/components/TrailSettingsModal.tsx
import React, { useState } from 'react';
import { useEnhancedMapContext } from '../../context/EnhancedMapContext';

interface TrailSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TrailSettingsModal: React.FC<TrailSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { maxTrailLength, setMaxTrailLength, trailsEnabled } =
    useEnhancedMapContext();

  // Local state for the form
  const [localTrailLength, setLocalTrailLength] = useState(maxTrailLength);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Apply settings
    setMaxTrailLength(localTrailLength);

    // Close modal
    onClose();
  };

  // Reset form when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setLocalTrailLength(maxTrailLength);
    }
  }, [isOpen, maxTrailLength]);

  if (!isOpen || !trailsEnabled) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Trail Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trail Length: {localTrailLength} positions
            </label>
            <div className="flex items-center">
              <span className="mr-2 text-sm">2</span>
              <input
                type="range"
                min="2"
                max="50"
                value={localTrailLength}
                onChange={(e) =>
                  setLocalTrailLength(parseInt(e.target.value, 10))
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="ml-2 text-sm">50</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Longer trails show more history but may affect performance.
            </p>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
            >
              Apply Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TrailSettingsModal;
