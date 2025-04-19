// pages/map.tsx
import React, { useState, useEffect } from 'react';
import type { NextPage } from 'next';
import dynamic from 'next/dynamic';
import { toast, Toaster } from 'react-hot-toast';
import AircraftSpinner from '../components/tracking/map/components/AircraftSpinner';

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
  const [isLoading, setIsLoading] = useState(true);

  // Handle errors
  const handleError = (message: string) => {
    toast.error(message);
  };

  // Fetch manufacturers
  useEffect(() => {
    const fetchManufacturers = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/tracking/manufacturers');
        if (!response.ok) {
          throw new Error(
            `Failed to fetch manufacturers: ${response.statusText}`
          );
        }

        const data = await response.json();
        setManufacturers(data.manufacturers || []);
      } catch (error) {
        console.error('Error fetching manufacturers:', error);
        handleError(
          `Error loading manufacturers: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchManufacturers();
  }, []);

  return (
    <div className="relative min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-600 p-4 text-white">
        <div className="container mx-auto">
          <h1 className="text-2xl font-bold">Aircraft Tracking</h1>
        </div>
      </header>

      {/* Toaster for notifications */}
      <Toaster position="top-right" />

      {/* Loading State */}
      {isLoading ? (
        <div
          className="flex justify-center items-center"
          style={{ height: 'calc(100vh - 64px)' }}
        >
          <AircraftSpinner isLoading={true} />
        </div>
      ) : (
        /* Map Area */
        <main style={{ height: 'calc(100vh - 64px)' }}>
          <AircraftTrackingMap
            manufacturers={manufacturers}
            onError={handleError}
          />
        </main>
      )}
    </div>
  );
};

export default MapPage;
