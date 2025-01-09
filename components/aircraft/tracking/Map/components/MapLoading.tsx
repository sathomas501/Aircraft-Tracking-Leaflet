// components/aircraft/tracking/Map/components/MapLoading.tsx
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export function MapLoading() {
  return (
    <div className="flex items-center justify-center h-screen bg-transparent">
      <LoadingSpinner />
    </div>
  );
}
