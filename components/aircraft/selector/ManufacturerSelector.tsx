import React, { useState, useEffect } from 'react';
import { Aircraft, SelectOption } from '@/types/base';

interface ManufacturerSelectorProps {
  onSelect: (manufacturer: string) => void;
  selectedManufacturer: string;
  manufacturers: SelectOption[];
  onAircraftUpdate: (aircraft: Aircraft[]) => void;
  onModelsUpdate: (
    models: {
      model: string;
      label: string;
      activeCount?: number;
      count?: number;
    }[]
  ) => void;
}

const ManufacturerSelector: React.FC<ManufacturerSelectorProps> = ({
  onSelect,
  selectedManufacturer,
  manufacturers,
  onAircraftUpdate,
  onModelsUpdate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredManufacturers, setFilteredManufacturers] =
    useState(manufacturers);
  const [showDropdown, setShowDropdown] = useState(false);

  // Filter manufacturers based on search input
  useEffect(() => {
    if (!searchTerm) {
      setFilteredManufacturers(manufacturers);
    } else {
      setFilteredManufacturers(
        manufacturers.filter((m) =>
          m.label.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
  }, [searchTerm, manufacturers]);

  // Handles manufacturer selection and loads models & aircraft
  const handleSelect = async (manufacturer: string) => {
    setSearchTerm(manufacturer); // ✅ Show selected manufacturer
    setShowDropdown(false); // ✅ Close dropdown
    onSelect(manufacturer);

    try {
      // Fetch ICAO24 aircraft IDs
      const icao24Response = await fetch('/api/aircraft/icao24s', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer }),
      });

      const icao24Data = await icao24Response.json();
      if (
        !icao24Data.success ||
        !Array.isArray(icao24Data.data.icao24List) ||
        icao24Data.data.icao24List.length === 0
      ) {
        throw new Error(`No ICAO24s found for ${manufacturer}`);
      }

      console.log('Fetched ICAO24s:', icao24Data.data.icao24List);

      // Fetch aircraft positions from OpenSky API
      const openSkyResponse = await fetch('/api/opensky', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          icao24s: icao24Data.data.icao24List.slice(0, 50), // ✅ Limit to 50 ICAO24s
        }),
      });

      const openSkyData = await openSkyResponse.json();
      if (!openSkyData.aircraft || !Array.isArray(openSkyData.aircraft)) {
        throw new Error('Invalid aircraft data received from OpenSky');
      }

      console.log(
        `Fetched ${openSkyData.aircraft.length} aircraft from OpenSky.`
      );
      onAircraftUpdate(openSkyData.aircraft); // ✅ Send aircraft data to parent

      // Fetch models for the selected manufacturer
      const modelResponse = await fetch(
        `/api/aircraft/models?manufacturer=${manufacturer}`
      );
      const modelData = await modelResponse.json();

      if (!modelData.success || !Array.isArray(modelData.models)) {
        throw new Error(`No models found for manufacturer: ${manufacturer}`);
      }

      console.log('Fetched models:', modelData.models);
      onModelsUpdate(modelData.models); // ✅ Send models to parent
    } catch (error) {
      console.error('Error fetching ICAO24s, OpenSky data, or models:', error);
    }
  };

  return (
    <div className="relative w-full">
      <label className="block text-sm font-medium text-gray-600">
        Manufacturer
      </label>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setShowDropdown(true); // ✅ Open dropdown on typing
        }}
        onFocus={() => setShowDropdown(true)}
        placeholder="Search or select manufacturer..."
        className="w-full p-2 pl-8 border border-gray-300 rounded-md shadow-sm
                   focus:ring-blue-500 focus:border-blue-500
                   bg-white text-gray-900"
      />

      {/* Manufacturer Dropdown */}
      {showDropdown && filteredManufacturers.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredManufacturers.map((manufacturer) => (
            <li
              key={manufacturer.value}
              className="px-4 py-2 text-left hover:bg-gray-100 flex justify-between cursor-pointer"
              onClick={() => handleSelect(manufacturer.value)}
            >
              <span>{manufacturer.label}</span>
              <span className="text-sm text-gray-500">
                {manufacturer.activeCount && manufacturer.activeCount > 0
                  ? `${manufacturer.activeCount.toLocaleString()} active / ${manufacturer.count?.toLocaleString()} total`
                  : `${manufacturer.count?.toLocaleString()} total`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* No Results Message */}
      {showDropdown && filteredManufacturers.length === 0 && (
        <p className="text-sm text-gray-500 mt-1">No manufacturers found.</p>
      )}
    </div>
  );
};

export default ManufacturerSelector;
