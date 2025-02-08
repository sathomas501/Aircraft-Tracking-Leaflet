<<<<<<< Updated upstream
import React, { useEffect, useState } from 'react';
import { fetchLiveData } from '../../../../lib/services/Unified-Aircraft-Position-Service'; // Mock API call
import type { Aircraft } from '@/types/base';
import DynamicMap from '../Map/DynamicMap';

// ✅ Define a proper interface for props
=======
import React, { useEffect, useState, useMemo } from 'react';
import { fetchLiveData } from '../../../../lib/services/Unified-Aircraft-Position-Service';
import type { Aircraft } from '@/types/base';
import DynamicMap from '../Map/DynamicMap';

>>>>>>> Stashed changes
interface MapComponentProps {
  aircraft: Aircraft[];
}

const MapComponent: React.FC<MapComponentProps> = ({ aircraft }) => {
  const [liveAircraft, setLiveAircraft] = useState<Aircraft[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'GOV' | 'NON_GOV'>('ALL');

  useEffect(() => {
    const fetchData = async () => {
<<<<<<< Updated upstream
      const data = await fetchLiveData([]); // Simulated API call
      setLiveAircraft(data);
=======
      if (aircraft.length === 0) return; // ✅ Prevents unnecessary API calls
      try {
        const data = await fetchLiveData(aircraft.map((ac) => ac.icao24));
        setLiveAircraft((prev) =>
          JSON.stringify(prev) === JSON.stringify(data) ? prev : data
        ); // ✅ Prevent unnecessary updates
      } catch (error) {
        console.error('Error fetching live data:', error);
      }
>>>>>>> Stashed changes
    };

    console.log('[MapComponent] Live Aircraft:', liveAircraft);

    useEffect(() => {
      console.log('[MapComponent] Received aircraft:', aircraft);
    }, [aircraft]);

    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [JSON.stringify(aircraft)]); // ✅ Only re-run when `aircraft` actually changes

<<<<<<< Updated upstream
  const filteredAircraft = liveAircraft
    .filter((ac) => {
      if (filter === 'GOV') return ac.OWNER_TYPE === '5'; // Government aircraft
      if (filter === 'NON_GOV') return ac.OWNER_TYPE !== '5'; // Non-Government aircraft
      return true; // Show all aircraft
    })
    .map((ac) => ({
      ...ac,
      type: ac.OWNER_TYPE === '5' ? 'Government' : 'Non-Government',
      isGovernment: ac.OWNER_TYPE === '5',
    }));
=======
  const filteredAircraft = useMemo(() => {
    return liveAircraft
      .filter((ac) => {
        if (filter === 'GOV') return ac.OWNER_TYPE === '5';
        if (filter === 'NON_GOV') return ac.OWNER_TYPE !== '5';
        return true;
      })
      .map((ac) => ({
        ...ac,
        type: ac.OWNER_TYPE === '5' ? 'Government' : 'Non-Government',
        isGovernment: ac.OWNER_TYPE === '5',
      }));
  }, [liveAircraft, filter]); // ✅ Memoized

  console.log('[MapComponent] Filtered Aircraft:', filteredAircraft);
>>>>>>> Stashed changes

  return (
    <div className="flex flex-col items-center p-4">
      <h1 className="text-xl font-bold mb-4">Aircraft Tracker</h1>

      <div className="flex gap-4 mb-4">
        <button
          className={`px-4 py-2 rounded ${
            filter === 'ALL' ? 'bg-blue-500 text-white' : 'bg-gray-200'
          }`}
          onClick={() => setFilter('ALL')}
        >
          Show All
        </button>

        <button
          className={`px-4 py-2 rounded ${
            filter === 'GOV' ? 'bg-green-500 text-white' : 'bg-gray-200'
          }`}
          onClick={() => setFilter('GOV')}
        >
          Government Aircraft
        </button>

        <button
          className={`px-4 py-2 rounded ${
            filter === 'NON_GOV' ? 'bg-red-500 text-white' : 'bg-gray-200'
          }`}
          onClick={() => setFilter('NON_GOV')}
        >
          Non-Government Aircraft
        </button>
      </div>

      <DynamicMap aircraft={filteredAircraft} />
    </div>
  );
};

export default MapComponent;
