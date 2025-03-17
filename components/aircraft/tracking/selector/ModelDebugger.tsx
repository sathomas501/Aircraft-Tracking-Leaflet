// ModelDebugger.tsx
import React, { useState } from 'react';
import { useModels } from '../ModelContext';

const ModelDebugger: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { models, selectedModel, isLoading, lastUpdated } = useModels();

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="text-xs text-gray-400 hover:text-gray-600 mt-2 p-1"
      >
        Show Debug Info
      </button>
    );
  }

  return (
    <div className="mt-2 p-2 border rounded bg-gray-50 text-xs">
      <div className="flex justify-between mb-1">
        <span className="font-medium">Model Debug Information</span>
        <button onClick={() => setIsExpanded(false)} className="text-gray-500">
          Hide
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1">
        <div>Total Models:</div>
        <div>{models.length}</div>

        <div>Active Models:</div>
        <div>{models.filter((m) => (m.activeCount || 0) > 0).length}</div>

        <div>Selected Model:</div>
        <div>{selectedModel || 'None'}</div>

        <div>Loading State:</div>
        <div>{isLoading ? 'Loading...' : 'Idle'}</div>

        <div>Last Updated:</div>
        <div>{lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}</div>
      </div>

      {models.length > 0 && (
        <div className="mt-2">
          <div className="font-medium mb-1">First Model Sample:</div>
          <pre className="bg-gray-200 p-1 overflow-auto max-h-32">
            {JSON.stringify(models[0], null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ModelDebugger;
