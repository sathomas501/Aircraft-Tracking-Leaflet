import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { fetchLiveData } from '@/lib/services/Unified-Aircraft-Position-Service';
import {
  fetchManufacturers,
  fetchIcao24s,
} from '@/components/aircraft/selector/services/aircraftService';
import type { Aircraft } from '@/types/base';

// Dynamic import for map
const DynamicMap = dynamic(
<<<<<<< Updated upstream
  () =>
    import('../components/aircraft/tracking/Map/DynamicMap').then(
      (mod) => mod.default
    ),

=======
  () => import('@/components/aircraft/tracking/Map/DynamicMap'),
>>>>>>> Stashed changes
  {
    ssr: false,
    loading: () => <LoadingSpinner message="Loading map..." />,
  }
);

export default function HomePage() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [icao24s, setIcao24s] = useState<string[]>([]);
  const [manufacturers, setManufacturers] = useState<
    { value: string; label: string; count?: number }[]
  >([]);
  const [selectedManufacturer, setSelectedManufacturer] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ Step 1: Fetch Manufacturers First
  useEffect(() => {
    const loadManufacturers = async () => {
      try {
        console.log('📡 Fetching manufacturers from API...');
        const data = await fetchManufacturers();
        console.log('✅ API Response for manufacturers:', data); // 🔍 Debug API response

        if (!Array.isArray(data) || data.length === 0) {
          console.warn('⚠️ No valid manufacturers found:', data);
          setError('No manufacturers available.');
          return;
        }

        setManufacturers(data); // ✅ Directly use API response
        console.log('✔️ Manufacturers state updated:', data);
      } catch (err) {
        console.error('❌ Error loading manufacturers:', err);
        setError('Failed to load manufacturers');
      } finally {
        setLoading(false);
      }
    };

    loadManufacturers();
  }, []);

  // ✅ Step 2: Fetch ICAO24s Only When a Manufacturer is Selected
  useEffect(() => {
    if (!selectedManufacturer) return;

    const fetchICAOs = async () => {
      try {
        const icaoList = await fetchIcao24s(selectedManufacturer);
        if (!icaoList || icaoList.length === 0) {
          console.warn(`⚠️ No ICAO24s found for: ${selectedManufacturer}`);
          return;
        }
        console.log(`✅ Retrieved ${icaoList.length} ICAO24s:`, icaoList);
        setIcao24s(icaoList);
      } catch (err) {
        console.error('❌ Error fetching ICAO24s:', err);
        setError('Failed to fetch ICAO24s.');
      }
    };

    fetchICAOs();
  }, [selectedManufacturer]);

  // ✅ Step 3: Fetch Aircraft Positions When ICAOs Are Available
  useEffect(() => {
    if (icao24s.length === 0) return;

    let retryCount = 0;
    const fetchAircraftData = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('[HomePage] Fetching aircraft data...');
        const data = await fetchLiveData(icao24s);
        console.log(`[HomePage] Aircraft received: ${data.length}`);
        setAircraft(data);
      } catch (error) {
        console.error('[HomePage] Error fetching aircraft:', error);
        setError('Failed to load aircraft data');
        retryCount += 1;
        if (retryCount >= 3) {
          console.warn('⚠️ Stopping retries after 3 failed attempts.');
          return;
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAircraftData();

    const interval = setInterval(() => {
      if (retryCount < 3) {
        fetchAircraftData();
      } else {
        clearInterval(interval);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [icao24s]);

  console.log('🛠️ Manufacturers state:', manufacturers); // ✅ Debug before rendering

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
<<<<<<< Updated upstream
    <main className="min-h-screen">
      <DynamicMap aircraft={[]} />
=======
    <main className="min-h-screen relative">
      {/* ✅ Show Spinner Only if Loading & No Data Available */}
      {loading && manufacturers.length === 0 && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-50 bg-opacity-75">
          <LoadingSpinner message="Loading manufacturers..." />
        </div>
      )}

      {/* ✅ Manufacturer Selector Dropdown */}
      <div className="absolute top-4 left-4 bg-white p-4 rounded shadow">
        <label htmlFor="manufacturer">Select Manufacturer:</label>
        <select
          id="manufacturer"
          onChange={(e) => setSelectedManufacturer(e.target.value)}
          value={selectedManufacturer || ''}
          className="border p-2"
        >
          <option value="">-- Select --</option>
          {manufacturers.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label} {m.count ? `(${m.count})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* ✅ Map Component */}
      <DynamicMap
        aircraft={aircraft}
        onError={(error: Error) => setError(error.message)}
      />
>>>>>>> Stashed changes
    </main>
  );
}
