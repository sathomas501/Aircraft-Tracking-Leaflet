import React, { useEffect, useState } from 'react';
import AircraftSpinner from '../tracking/map/components/AircraftSpinner';

interface LayoutProps {
  children: React.ReactNode;
  aircraft?: number;
  title: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, aircraft }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100); // Small delay to ensure styles are applied

    return () => clearTimeout(timer);
  }, []);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AircraftSpinner isLoading={true} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-gray-900">
              Aircraft Tracking System
            </h1>
            <div className="text-sm text-gray-600">
              {aircraft} Aircraft{aircraft !== 1 ? 's' : ''} Tracked
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;
