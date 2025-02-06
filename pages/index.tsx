// pages/index.tsx
import dynamic from 'next/dynamic';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

const DynamicMap = dynamic(
  () =>
    import('../components/aircraft/tracking/Map/DynamicMap').then(
      (mod) => mod.default
    ),

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
      <DynamicMap aircraft={[]} />
    </main>
  );
}
