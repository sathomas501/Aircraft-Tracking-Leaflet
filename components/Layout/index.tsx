import React, { useEffect, useState } from 'react';

interface LayoutProps {
  children: React.ReactNode;
  aircraft: number;
}

export const Layout: React.FC<LayoutProps> = ({ children, aircraft }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Check if document is loaded
    if (document.readyState === 'complete') {
      setIsLoaded(true);
    } else {
      window.addEventListener('load', () => setIsLoaded(true));
    }

    return () => {
      window.removeEventListener('load', () => setIsLoaded(true));
    };
  }, []);

  return (
    <div className={`page-ready ${isLoaded ? 'loaded' : ''}`}>
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