<<<<<<< Updated upstream
import React, { useState, useEffect } from 'react';
import { SelectOption } from '@/types/base';
=======
import React, { useState } from 'react';
import { useFetchManufacturers } from '../customHooks/useFetchManufactures';
import { fetchIcao24s } from '../selector/services/aircraftService'; // ✅ Import fetchIcao24s
>>>>>>> Stashed changes

interface ManufacturerSelectorProps {
  onSelect: (manufacturer: string) => void;
  selectedManufacturer: string;
  manufacturers: SelectOption[];
}

const ManufacturerSelector: React.FC<ManufacturerSelectorProps> = ({
  onSelect,
  selectedManufacturer,
}) => {
<<<<<<< Updated upstream
  const [manufacturers, setManufacturers] = useState<SelectOption[]>([]);
  const [icao24s, setIcao24s] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch manufacturers on mount
  useEffect(() => {
    const fetchManufacturers = async () => {
      try {
        const response = await fetch('/api/manufacturers');
        if (!response.ok)
          throw new Error(`Failed to fetch manufacturers: ${response.status}`);

        const data = await response.json();
        console.log('Fetched Manufacturers (Raw):', data); // ✅ Check raw API response

        // ✅ Access the manufacturers array inside the object
        const formattedData = (data.manufacturers || []).map((item: any) => ({
          value: item.value,
          label: item.label,
        }));

        console.log('Formatted Manufacturers:', formattedData); // ✅ Check formatted data

        setManufacturers(formattedData); // ✅ Update state
      } catch (err) {
        console.error('Error fetching manufacturers:', err);
        setManufacturers([]);
      }
    };

    fetchManufacturers();
  }, []);

  const fetchIcao24s = async (manufacturer: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/aircraft/tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer }),
      });
      const data = await response.json();

      if (data.icao24s) {
        setIcao24s(data.icao24s);
      } else {
        console.warn('No ICAO24s found.');
      }
    } catch (error) {
      console.error('Error fetching ICAO24s:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (manufacturer: string) => {
    onSelect(manufacturer);
    fetchIcao24s(manufacturer);
  };

  return (
    <div>
      <h3>Select Manufacturer</h3>
      {error && <p className="text-red-500">{error}</p>}

      <ul>
        {Array.isArray(manufacturers) && manufacturers.length > 0 ? (
          manufacturers.map((m) => (
            <li key={m.value}>
              <button
                onClick={() => handleSelect(m.value)}
                className={`p-2 rounded-md ${
                  selectedManufacturer === m.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200'
                }`}
              >
                {m.label}
              </button>
            </li>
          ))
        ) : (
          <li>No manufacturers available</li> // ✅ Graceful fallback message
        )}
      </ul>
=======
  const { manufacturers, loading } = useFetchManufacturers();
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (manufacturer: string) => {
    if (manufacturer !== selectedManufacturer) {
      onSelect(manufacturer); // ✅ Update selection first

      // ✅ Delay ICAO fetch until after state updates
      setTimeout(async () => {
        try {
          const icao24s = await fetchIcao24s(manufacturer);
          console.log(
            `✈️ Retrieved ${icao24s.length} ICAO24s for ${manufacturer}`
          );
        } catch (err) {
          console.error('Error fetching ICAO24s:', err);
          setError('Failed to fetch ICAO24s.');
        }
      }, 100); // Small delay to ensure state updates
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Select Manufacturer</h3>
>>>>>>> Stashed changes

      {error && <p className="text-red-500">{error}</p>}

      {loading ? (
        <p className="text-gray-600">Loading manufacturers...</p>
      ) : (
        <ul className="space-y-2">
          {manufacturers.map((m) => (
            <li key={m.value}>
              <button
                onClick={() => handleSelect(m.value)}
                className={`w-full p-2 rounded-md transition ${
                  selectedManufacturer === m.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                {m.label} ({m.count})
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ManufacturerSelector;
