// pages/map.tsx
import React, { useState } from 'react';
import type { NextPage } from 'next';
import dynamic from 'next/dynamic';
import { toast } from 'react-hot-toast';
import AircraftSpinner from '../components/tracking/map/components/AircraftSpinner';
import Ribbon from '../components/tracking/Ribbon'; // Import the enhanced Ribbon

// Dynamically import the map component
const AircraftTrackingMap = dynamic(
  () => import('@/components/tracking/map/AircraftTrackingMap'),
  {
    ssr: false,
    loading: () => <AircraftSpinner isLoading={true} />,
  }
);

const MapPage: NextPage = () => {
  const [isLoading, setIsLoading] = useState(false); // Set to false to immediately show map

  // Handle errors
  const handleError = (message: string) => {
    toast.error(message);
  };

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Replace the header and manufacturer list with Ribbon */}
      <Ribbon />

      {/* Map Area */}
      <main className="flex-grow">
        <AircraftTrackingMap
          manufacturers={[]} // Empty array to remove manufacturer list
          onError={handleError}
        />
      </main>

      {/* Loading spinner (only show when actually loading) */}
      {isLoading && (
        <div className="absolute inset-0 flex justify-center items-center bg-white bg-opacity-70 z-50">
          <AircraftSpinner isLoading={true} />
        </div>
      )}
    </div>
  );
};

export default MapPage;
