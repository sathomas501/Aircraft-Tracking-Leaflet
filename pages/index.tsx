import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useFetchManufacturers } from '../components/aircraft/customHooks/useFetchManufactures';
import type { Aircraft } from '@/types/base';

// Dynamically load MapWrapper to avoid SSR issues
const DynamicMap = dynamic(
  () => import('@/components/aircraft/tracking/mapWrapper/MapWrapper'),
  { ssr: false, loading: () => <LoadingSpinner message="Loading map..." /> }
);

export default function HomePage() {
  const { manufacturers, loading: manufacturersLoading } =
    useFetchManufacturers();
  const [error, setError] = useState<string | null>(null);

  // Debug logging
  useEffect(() => {
    console.log('Manufacturers loaded:', manufacturers?.length);
  }, [manufacturers]);

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
      {/* Use dynamically imported MapWrapper */}
      <DynamicMap
        initialAircraft={[]}
        manufacturers={manufacturers || []}
        onError={setError}
      />
    </div>
  );
}
