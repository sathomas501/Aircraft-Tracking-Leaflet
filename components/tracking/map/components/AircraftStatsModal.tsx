// components/tracking/map/components/AircraftStatsModal.tsx
import React from 'react';
import { useEnhancedMapContext } from '../../context/EnhancedMapContext';

interface AircraftStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AircraftStatsModal: React.FC<AircraftStatsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    selectedManufacturer,
    activeModels,
    totalActive,
    displayedAircraft,
    selectedModel,
  } = useEnhancedMapContext();

  if (!isOpen) return null;

  // Calculate statistics
  const totalAltitude = displayedAircraft.reduce(
    (sum, aircraft) => sum + (aircraft.altitude || 0),
    0
  );
  const avgAltitude =
    displayedAircraft.length > 0
      ? Math.round(totalAltitude / displayedAircraft.length)
      : 0;

  const totalSpeed = displayedAircraft.reduce(
    (sum, aircraft) => sum + (aircraft.velocity || 0),
    0
  );
  const avgSpeed =
    displayedAircraft.length > 0
      ? Math.round(totalSpeed / displayedAircraft.length)
      : 0;

  const inFlight = displayedAircraft.filter((a) => !a.on_ground).length;
  const onGround = displayedAircraft.filter((a) => a.on_ground).length;

  // Group by MODEL type
  const modelCounts = displayedAircraft.reduce(
    (counts, aircraft) => {
      const MODEL = aircraft.MODEL || aircraft.AIRCRAFT_TYPE || 'Unknown';
      counts[MODEL] = (counts[MODEL] || 0) + 1;
      return counts;
    },
    {} as Record<string, number>
  );

  // Sort models by count
  const sortedModels = Object.entries(modelCounts).sort(
    ([, countA], [, countB]) => countB - countA
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-blue-50 rounded-t-lg flex justify-between items-center">
          <h2 className="text-xl font-bold text-blue-900 flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Aircraft Statistics
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {/* Manufacturer/Model Info */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">
              {selectedManufacturer || 'No Manufacturer Selected'}
            </h3>
            <p className="text-gray-600">
              {selectedModel
                ? `Filtering to ${selectedModel} aircraft`
                : `Tracking all models - ${activeModels.length} MODEL types, ${totalActive} total aircraft`}
            </p>
          </div>

          {/* Stats overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-blue-600 mb-1">Total Aircraft</div>
              <div className="text-2xl font-bold">
                {displayedAircraft.length}
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-green-600 mb-1">In Flight</div>
              <div className="text-2xl font-bold">{inFlight}</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-sm text-yellow-600 mb-1">On Ground</div>
              <div className="text-2xl font-bold">{onGround}</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-sm text-purple-600 mb-1">
                Different Models
              </div>
              <div className="text-2xl font-bold">
                {Object.keys(modelCounts).length}
              </div>
            </div>
          </div>

          {/* Average metrics */}
          <div className="mb-6">
            <h3 className="text-md font-medium mb-2">Average Metrics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="border p-3 rounded-lg">
                <div className="text-sm text-gray-500 mb-1">
                  Average Altitude
                </div>
                <div className="text-xl font-semibold">
                  {avgAltitude.toLocaleString()} ft
                </div>
              </div>
              <div className="border p-3 rounded-lg">
                <div className="text-sm text-gray-500 mb-1">Average Speed</div>
                <div className="text-xl font-semibold">{avgSpeed} kts</div>
              </div>
            </div>
          </div>

          {/* Model breakdown */}
          <div>
            <h3 className="text-md font-medium mb-2">Model Breakdown</h3>
            <div className="max-h-64 overflow-y-auto border rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Model
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Count
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Percentage
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedModels.map(([MODEL, count], index) => (
                    <tr
                      key={index}
                      className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    >
                      <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                        {MODEL}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                        {count}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div
                              className="bg-blue-600 h-2.5 rounded-full"
                              style={{
                                width: `${(count / displayedAircraft.length) * 100}%`,
                              }}
                            ></div>
                          </div>
                          <span className="ml-2">
                            {Math.round(
                              (count / displayedAircraft.length) * 100
                            )}
                            %
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t mt-auto">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AircraftStatsModal;
