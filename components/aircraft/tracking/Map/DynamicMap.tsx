<<<<<<< Updated upstream
import React, { useEffect, useState } from 'react';
=======
import React, { useEffect, useState, useMemo } from 'react';
>>>>>>> Stashed changes
import { fetchLiveData } from '../../../../lib/services/Unified-Aircraft-Position-Service'; // Mock API call
import type { Aircraft } from '@/types/base';
import DynamicMap from './DynamicMap'; // Adjust the path as necessary

// ✅ Define a proper interface for props
interface MapComponentProps {
  aircraft: Aircraft[];
<<<<<<< Updated upstream
=======
  onError?: (error: Error) => void; // ✅ Ensure this exists
  onSelectManufacturer?: (manufacturer: string) => void; // ✅ Ensure this exists
>>>>>>> Stashed changes
}

const MapComponent: React.FC<MapComponentProps> = ({ aircraft }) => {
  const [liveAircraft, setLiveAircraft] = useState<Aircraft[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'GOV' | 'NON_GOV'>('ALL');

  useEffect(() => {
    const fetchData = async () => {
      try {
<<<<<<< Updated upstream
        const data = await fetchLiveData(aircraft.map((ac) => ac.icao24)); // Pass valid ICAO24 list
        setLiveAircraft(data);
=======
        const icaoList = aircraft.map((ac) => ac.icao24);
        if (icaoList.length === 0) return; // ✅ Prevent fetching with empty list

        const data = await fetchLiveData(icaoList);
        setLiveAircraft((prev) =>
          JSON.stringify(prev) === JSON.stringify(data) ? prev : data
        ); // ✅ Prevent unnecessary state updates
>>>>>>> Stashed changes
      } catch (error) {
        console.error('Error fetching live data:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds

<<<<<<< Updated upstream
    return () => clearInterval(interval); // Cleanup on unmount
  }, [aircraft]); // Depend on `aircraft` to fetch when it updates

  const filteredAircraft = liveAircraft
    .filter((ac) => {
      if (!ac.OWNER_TYPE) return false; // ✅ Prevent undefined errors
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
    return () => clearInterval(interval); // Cleanup
  }, [JSON.stringify(aircraft)]); // ✅ Prevent unnecessary reruns

  const filteredAircraft = useMemo(() => {
    return liveAircraft
      .filter((ac) => {
        if (!ac.OWNER_TYPE) return false;
        if (filter === 'GOV') return ac.OWNER_TYPE === '5';
        if (filter === 'NON_GOV') return ac.OWNER_TYPE !== '5';
        return true;
      })
      .map((ac) => ({
        ...ac,
        type: ac.OWNER_TYPE === '5' ? 'Government' : 'Non-Government',
        isGovernment: ac.OWNER_TYPE === '5',
      }));
  }, [liveAircraft, filter]); // ✅ Only recalculates when necessary
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
