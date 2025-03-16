// pages/index.tsx
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useFetchManufacturers } from '../hooks/useFetchManufactures';
import type { MapWrapperProps } from '../components/aircraft/tracking/mapWrapper/MapWrapper';

// Type the dynamic import
const DynamicMapWrapper = dynamic<MapWrapperProps>(
  () =>
    import('../components/aircraft/tracking/mapWrapper/MapWrapper').then(
      (mod) => mod.default
    ), // Get the default export
  {
    ssr: false,
    loading: () => <LoadingSpinner message="Loading MapWrapper..." />,
  }
);

export default function HomePage() {
  const { manufacturers, loading: manufacturersLoading } =
    useFetchManufacturers();
  const [error, setError] = useState<string | null>(null);

  // Debug logging
  useEffect(() => {
    console.log('Manufacturers loaded:', manufacturers?.length);
  }, [manufacturers]);

  console.log('[HomePage] Component is rendering!');
  console.log('[HomePage] Manufacturers:', manufacturers);
  console.log('[HomePage] Manufacturers length:', manufacturers?.length);
  console.log('[HomePage] Manufacturers passed to MapWrapper:', manufacturers);

  // Error display component
  const ErrorDisplay = ({ message }: { message: string }) => (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-red-500">{message}</div>
    </div>
  );

  if (manufacturersLoading) {
    return <LoadingSpinner message="Loading manufacturers..." />;
  }

  if (error) {
    return <ErrorDisplay message={error} />;
  }

  return (
    <div className="relative min-h-screen w-full">
      <DynamicMapWrapper
        initialAircraft={[]}
        manufacturers={manufacturers || []}
        onError={setError}
      />
    </div>
  );
}
