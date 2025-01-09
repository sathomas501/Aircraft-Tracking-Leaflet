import dynamic from 'next/dynamic';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

// No SSR for the map component
const MapWithNoSSR = dynamic(
  () => import('@/components/aircraft/tracking/Map').then((mod) => mod.MapWrapper),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen bg-transparent">
        <LoadingSpinner size="md" />
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
