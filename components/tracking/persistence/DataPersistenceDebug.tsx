// components/tracking/map/DataPersistenceDebug.tsx
import React, { useState, useEffect } from 'react';
import { useDataPersistence } from './DataPersistenceManager';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';

const DataPersistenceDebug: React.FC = () => {
  const { cachedAircraft, clearCache, cacheSize, lastUpdated, sessionId } =
    useDataPersistence();

  const { displayedAircraft, selectedAircraft, trailsEnabled, aircraftTrails } =
    useEnhancedMapContext();

  const [storageUsage, setStorageUsage] = useState<string>('Calculating...');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Calculate localStorage usage
  useEffect(() => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    try {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key) || '';
          total += key.length + value.length;
        }
      }

      // Convert to KB
      const kb = (total / 1024).toFixed(2);
      setStorageUsage(`${kb} KB / 5000 KB`);
    } catch (error) {
      setStorageUsage('Error calculating');
    }
  }, [cachedAircraft]);

  const toggleSection = (section: string) => {
    if (expandedSection === section) {
      setExpandedSection(null);
    } else {
      setExpandedSection(section);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 text-sm overflow-auto max-h-96">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-bold">Persistence Debug</h3>
        <button
          onClick={clearCache}
          className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
        >
          Clear Cache
        </button>
      </div>

      <div className="space-y-2">
        {/* Basic Stats Section */}
        <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded">
          <div className="flex justify-between">
            <span>Cached Aircraft:</span>
            <span>{cacheSize}</span>
          </div>

          <div className="flex justify-between">
            <span>Displayed Aircraft:</span>
            <span>{displayedAircraft.length}</span>
          </div>

          <div className="flex justify-between">
            <span>Selected Aircraft:</span>
            <span>{selectedAircraft?.icao24 || 'None'}</span>
          </div>

          <div className="flex justify-between">
            <span>Trail Points:</span>
            <span>
              {trailsEnabled
                ? Array.from(aircraftTrails.entries()).reduce(
                    (total, [, trail]) => total + trail.length,
                    0
                  )
                : 'Disabled'}
            </span>
          </div>

          <div className="flex justify-between">
            <span>Storage Usage:</span>
            <span>{storageUsage}</span>
          </div>

          <div className="flex justify-between">
            <span>Session ID:</span>
            <span className="truncate max-w-xs" title={sessionId}>
              {sessionId.substring(0, 10)}...
            </span>
          </div>

          <div className="flex justify-between">
            <span>Last Updated:</span>
            <span>
              {lastUpdated
                ? new Date(lastUpdated).toLocaleTimeString()
                : 'Never'}
            </span>
          </div>
        </div>

        {/* Expandable Sections */}
        <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded">
          <button
            className="w-full text-left font-medium flex justify-between items-center"
            onClick={() => toggleSection('selectedDetails')}
          >
            <span>Selected Aircraft Details</span>
            <span>{expandedSection === 'selectedDetails' ? '▼' : '▶'}</span>
          </button>

          {expandedSection === 'selectedDetails' && selectedAircraft && (
            <div className="mt-2 pl-2 border-l-2 border-gray-300 dark:border-gray-600">
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                {Object.entries(selectedAircraft).map(([key, value]) => (
                  <React.Fragment key={key}>
                    <div className="font-medium">{key}:</div>
                    <div className="truncate">
                      {value !== null && value !== undefined
                        ? typeof value === 'object'
                          ? JSON.stringify(value).substring(0, 20)
                          : String(value).substring(0, 20)
                        : 'null'}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Persistence Issues Section */}
        <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded">
          <button
            className="w-full text-left font-medium flex justify-between items-center"
            onClick={() => toggleSection('diagnostics')}
          >
            <span>Diagnostics</span>
            <span>{expandedSection === 'diagnostics' ? '▼' : '▶'}</span>
          </button>

          {expandedSection === 'diagnostics' && (
            <div className="mt-2 text-xs">
              <div className="mb-1">
                <span className="font-medium">localStorage Available: </span>
                <span>
                  {typeof window !== 'undefined' && 'localStorage' in window
                    ? 'Yes'
                    : 'No'}
                </span>
              </div>

              <div className="mb-1">
                <span className="font-medium">Cache Match: </span>
                <span>
                  {
                    displayedAircraft.filter(
                      (a) => a.icao24 && cachedAircraft[a.icao24]
                    ).length
                  }{' '}
                  / {displayedAircraft.length}
                </span>
              </div>

              <div className="mb-1">
                <span className="font-medium">Refresh Count: </span>
                <span>
                  {typeof sessionStorage !== 'undefined'
                    ? parseInt(
                        sessionStorage.getItem('debug_refresh_count') || '0'
                      ) + 1
                    : '?'}
                </span>
              </div>

              <div className="mb-1">
                <span className="font-medium">Issues: </span>
                <span>
                  {cacheSize === 0 ? 'No cached data' : ''}
                  {lastUpdated && Date.now() - lastUpdated > 60000
                    ? 'Stale cache'
                    : ''}
                  {!lastUpdated ? 'Never updated' : ''}
                  {!cacheSize && !lastUpdated ? 'None detected' : ''}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Refresh counter */}
      <div className="mt-2 text-xs text-gray-500 text-right">
        {typeof window !== 'undefined' &&
          typeof sessionStorage !== 'undefined' && (
            <span>
              Session refreshes:{' '}
              {(() => {
                try {
                  const count = parseInt(
                    sessionStorage.getItem('debug_refresh_count') || '0'
                  );
                  sessionStorage.setItem(
                    'debug_refresh_count',
                    (count + 1).toString()
                  );
                  return count + 1;
                } catch (e) {
                  return '?';
                }
              })()}
            </span>
          )}
      </div>
    </div>
  );
};

export default DataPersistenceDebug;
