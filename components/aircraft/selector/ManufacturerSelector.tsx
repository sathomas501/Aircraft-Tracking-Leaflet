import React, { useState, useEffect } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface ManufacturerSelectorProps {
  manufacturers: SelectOption[];
  onSelect: (manufacturer: string) => void;
  selectedManufacturer: string;
}

const ManufacturerSelector: React.FC<ManufacturerSelectorProps> = ({
  manufacturers,
  onSelect,
  selectedManufacturer
}) => {
  const [icao24s, getIcao24s] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchIcao24s = async (manufacturer: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/track-manufacturer?manufacturer=${manufacturer}`);
      const data = await response.json();

      if (data.icao24s) {
        getIcao24s(data.icao24s);
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
    fetchIcao24s(manufacturer); // ✅ API call instead of direct DB access
  };

  return (
    <div>
      <h3>Select Manufacturer</h3>
      <ul>
        {manufacturers.map((m) => (
          <li key={m.value}>
            <button onClick={() => handleSelect(m.value)}>
              {m.label}
            </button>
          </li>
        ))}
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
