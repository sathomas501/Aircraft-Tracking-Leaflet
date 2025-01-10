// pages/map.tsx
import dynamic from 'next/dynamic';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

const MapWithNoSSR = dynamic(
  () => import('@/components/aircraft/tracking/Map/MapWrapper').then(mod => mod.MapWrapper),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <LoadingSpinner message="Loading map..." />
      </div>
    ),
  }
);

export default function MapPage() {
  return (
    <div className="w-full h-screen">
      <MapWithNoSSR />
    </div>
  );
}