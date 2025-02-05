import React, { useEffect, useState } from 'react';
import DynamicMap from './DynamicMap';
import { fetchLiveData } from '../../../../lib/services/fetch-Live-Data'; // Mock API call
import type { Aircraft } from '@/types/base';

const MapComponent: React.FC = () => {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'GOV' | 'NON_GOV'>('ALL');

  useEffect(() => {
    const fetchData = async () => {
      const data = await fetchLiveData([]); // Simulated API call with empty array
      setAircraft(data);
    };

    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const filteredAircraft = aircraft
    .filter((ac) => {
      if (filter === 'GOV') return ac.OWNER_TYPE === '5';      // Government aircraft
      if (filter === 'NON_GOV') return ac.OWNER_TYPE !== '5';  // Non-Government aircraft
      return true; // Show all aircraft
    })
    .map((ac) => ({
      ...ac,
      type: ac.OWNER_TYPE === '5' ? 'Government' : 'Non-Government',
      isGovernment: ac.OWNER_TYPE === '5',
    }));

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
