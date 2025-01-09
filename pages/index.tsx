// pages/index.tsx
import dynamic from 'next/dynamic';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

// Dynamically import the map with no SSR
const MapWithNoSSR = dynamic(
  () => import('@/components/aircraft/tracking/Map').then(mod => mod.MapWrapper),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <LoadingSpinner message="Loading map..." />
      </div>
    ),
  }
);

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <MapWithNoSSR />
    </main>
  );
}

// Mark this page as static to avoid SSR issues
export const getStaticProps = () => {
  return {
    props: {},
  };
};