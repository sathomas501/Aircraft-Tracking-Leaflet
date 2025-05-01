// pages/map.tsx
import React, { useState, useEffect } from 'react';
import type { NextPage } from 'next';
import dynamic from 'next/dynamic';
import { toast, Toaster } from 'react-hot-toast';
import AircraftSpinner from '../components/tracking/map/components/AircraftSpinner';

// Import or define RegionCode enum
export enum RegionCode {
  GLOBAL = 0,
  NORTH_AMERICA = 1,
  // Add other regions as needed
}

const RegionNames: Record<RegionCode, string> = {
  [RegionCode.GLOBAL]: 'Global',
  [RegionCode.NORTH_AMERICA]: 'North America',
};

// Region selector overlay
const RegionSelector: React.FC<{
  onSelectRegion: (region: RegionCode) => void;
}> = ({ onSelectRegion }) => (
  <div className="fixed inset-0 bg-gray-100 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Select Region</h2>
      <p className="mb-6 text-gray-600">
        Please select a region to load aircraft tracking data.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          className="py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition"
          onClick={() => onSelectRegion(RegionCode.NORTH_AMERICA)}
        >
          North America
        </button>
        <button
          className="py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition"
          onClick={() => onSelectRegion(RegionCode.GLOBAL)}
        >
          Global
        </button>
      </div>
    </div>
  </div>
);

// Dynamically import the map component
const AircraftTrackingMap = dynamic(
  () => import('@/components/tracking/map/AircraftTrackingMap'),
  {
    ssr: false,
    loading: () => <AircraftSpinner isLoading={true} />,
  }
);

const MapPage: NextPage = () => {
  const [manufacturers, setManufacturers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<RegionCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRegionSelector, setShowRegionSelector] = useState(true);

  const handleError = (message: string) => {
    console.error(`Map error: ${message}`);
    setError(message);
    toast.error(message);
    setTimeout(() => setError(null), 5000);
  };

  const handleRegionSelect = (region: RegionCode) => {
    console.log(`Region selected: ${region} (${RegionNames[region]})`);
    setSelectedRegion(region);
    setShowRegionSelector(false);
    setIsLoading(true);
    setError(null);
  };

  useEffect(() => {
    if (selectedRegion === null) return;

    console.log(`Fetching manufacturers for region: ${selectedRegion}`);

    const fetchManufacturers = async () => {
      try {
        setIsLoading(true);
        console.log(
          `Making API call to: /api/tracking/manufacturers?region=${selectedRegion}`
        );

        const response = await fetch(
          `/api/tracking/manufacturers?region=${selectedRegion}`
        );

        if (!response.ok) {
          throw new Error(`Fetch failed: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(
          `Received ${data.manufacturers?.length || 0} manufacturers from API`
        );

        setManufacturers(data.manufacturers || []);
        setError(null);
      } catch (error) {
        console.error('Error fetching manufacturers:', error);
        handleError(
          `Error loading manufacturers: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
        setShowRegionSelector(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchManufacturers();

    const timeoutId = setTimeout(() => {
      if (isLoading) {
        console.warn('⚠️ Manufacturer fetch timeout (5s)');
        handleError(
          'Data loading timed out. Try selecting a different region or refresh the page.'
        );
        setIsLoading(false);
        setShowRegionSelector(true);
      }
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, [selectedRegion]);

  return (
    <div className="relative min-h-screen bg-gray-50">
      <header className="bg-blue-600 p-4 text-white">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Aircraft Tracking</h1>
          {selectedRegion !== null && !showRegionSelector && (
            <div className="flex items-center space-x-2">
              <span>Region: {RegionNames[selectedRegion]}</span>
              <button
                className="px-3 py-1 rounded bg-blue-700 hover:bg-blue-800 text-white text-sm"
                onClick={() => setShowRegionSelector(true)}
              >
                Change
              </button>
            </div>
          )}
        </div>
      </header>

      <Toaster position="top-right" />

      {showRegionSelector && (
        <RegionSelector onSelectRegion={handleRegionSelect} />
      )}

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 mx-4 mt-4">
          <p>{error}</p>
        </div>
      )}

      {isLoading && (
        <div
          className="flex justify-center items-center"
          style={{ height: 'calc(100vh - 64px)' }}
        >
          <AircraftSpinner isLoading={true} />
        </div>
      )}

      {selectedRegion !== null && !isLoading && !showRegionSelector && (
        <main style={{ height: 'calc(100vh - 64px)' }}>
          <AircraftTrackingMap
            manufacturers={manufacturers}
            selectedRegion={selectedRegion}
            onError={handleError}
          />
        </main>
      )}
    </div>
  );
};

export default MapPage;
