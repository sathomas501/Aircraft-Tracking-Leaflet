import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { SelectOption } from '@/types/base';
import manufacturersService from '@/lib/services/ManufacturersService';

const MapWithNoSSR = dynamic(
  () =>
    import('../components/aircraft/tracking/mapWrapper/MapWrapper').then(
      (mod) => {
        console.log('Dynamic import resolved:', mod);
        return mod.MapWrapper || mod.default; // Try both exports
      }
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-screen flex items-center justify-center">
        Loading map...
      </div>
    ),
  }
);

export default function MapPage() {
  const [manufacturers, setManufacturers] = useState<SelectOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load manufacturers when the component mounts
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        console.log('Loading manufacturers via service...');
        const data = await manufacturersService.loadManufacturers();
        console.log(`Loaded ${data.length} manufacturers`);
        setManufacturers(data);
      } catch (err) {
        console.error('Error loading manufacturers:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to load manufacturers'
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleError = (message: string) => {
    console.error(message);
    setError(message);
  };

  return (
    <div className="w-full h-screen">
      {error && (
        <div className="fixed top-4 right-4 bg-red-500 text-white p-3 rounded-md shadow-lg z-50">
          <p>{error}</p>
          <button
            onClick={() => setError(null)}
            className="absolute top-1 right-1 text-white"
          >
            ✕
          </button>
        </div>
      )}

      <MapWithNoSSR manufacturers={manufacturers} onError={handleError} />

      {loading && (
        <div className="fixed top-4 left-4 bg-blue-500 text-white p-3 rounded-md shadow-lg z-50">
          Loading manufacturers...
        </div>
      )}
    </div>
  );
}
