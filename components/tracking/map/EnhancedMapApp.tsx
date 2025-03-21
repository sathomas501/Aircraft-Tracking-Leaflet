// components/tracking/map/EnhancedMapApp.tsx
import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { EnhancedMapProvider } from '../context/EnhancedMapContext';
import ContextUnifiedSelector from '../selector/ContextUnifiedSelector';
import type { SelectOption } from '@/types/base';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

// Dynamically import map implementations to avoid SSR issues
const EnhancedReactBaseMap = dynamic(() => import('./EnhancedReactBaseMap'), {
  ssr: false,
  loading: () => <LoadingSpinner message="Loading enhanced map..." />,
});

// Props for EnhancedMapApp
interface EnhancedMapAppProps {
  manufacturers: SelectOption[];
  onError: (message: string) => void;
}

const EnhancedMapApp: React.FC<EnhancedMapAppProps> = ({
  manufacturers,
  onError,
}) => {
  return (
    <EnhancedMapProvider manufacturers={manufacturers} onError={onError}>
      <div className="relative w-full h-screen">
        {/* Map Component */}
        <EnhancedReactBaseMap onError={onError} />

        {/* Unified Selector */}
        <div className="absolute top-0 left-0 right-0 z-10 max-w-sm ml-4 mt-4">
          <ContextUnifiedSelector manufacturers={manufacturers} />
        </div>

        {/* Visual indicator that this is the enhanced version */}
        <div className="absolute top-4 right-4 z-50 bg-green-100 text-green-800 px-4 py-2 rounded shadow">
          Enhanced Architecture
        </div>
      </div>
    </EnhancedMapProvider>
  );
};

export default EnhancedMapApp;
