import React, { useState, useEffect } from 'react';
import { SelectOption } from '@/types/base';

interface ManufacturerSelectorProps {
  onSelect: (manufacturer: string) => void;
  selectedManufacturer: string;
  manufacturers: SelectOption[];
}

const ManufacturerSelector: React.FC<ManufacturerSelectorProps> = ({
  onSelect,
  selectedManufacturer,
}) => {
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

      {loading && <p>Loading ICAO24s...</p>}
      {!loading && icao24s.length > 0 && (
        <ul>
          {icao24s.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ManufacturerSelector;
