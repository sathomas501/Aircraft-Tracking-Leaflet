<<<<<<< Updated upstream
import React from 'react';
=======
import React, { useCallback, useState } from 'react';
>>>>>>> Stashed changes
import { X, Plane } from 'lucide-react';

interface NNumberSelectorProps {
  nNumber: string;
  setNNumber: (nNumber: string) => void;
<<<<<<< Updated upstream
  onSearch: () => void;
}

const NNumberSelector: React.FC<NNumberSelectorProps> = ({ nNumber, setNNumber, onSearch }) => {
=======
  onSearch: (nNumber: string) => Promise<void>; // ✅ Ensuring `onSearch` is asynchronous
}

const NNumberSelector: React.FC<NNumberSelectorProps> = ({
  nNumber,
  setNNumber,
  onSearch,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!nNumber.trim()) return; // ✅ Prevent empty searches
    if (nNumber.length < 3) {
      setError('N-Number must be at least 3 characters long.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onSearch(nNumber); // ✅ Wait for the API response
    } catch (error) {
      console.error('Error searching for N-Number:', error);
      setError('Failed to search. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [nNumber, onSearch]);

>>>>>>> Stashed changes
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-600">
        N-Number
      </label>
      <div className="relative">
        <div className="flex space-x-2">
          {/* Input Field */}
          <div className="relative flex-1">
            <input
              type="text"
              value={nNumber}
              onChange={(e) => setNNumber(e.target.value.toUpperCase())}
              placeholder="Enter N-Number..."
              className="w-full p-2 pl-8 border border-gray-300 rounded-md shadow-sm
                         focus:ring-blue-500 focus:border-blue-500
                         bg-white text-gray-900"
              maxLength={6}
<<<<<<< Updated upstream
            />
            <Plane className="absolute left-2 top-2.5 text-gray-400" size={16} />
=======
              aria-label="N-Number input"
            />
            <Plane
              className="absolute left-2 top-2.5 text-gray-400"
              size={16}
            />
>>>>>>> Stashed changes
          </div>

          {/* Clear Button */}
          {nNumber && (
            <button
<<<<<<< Updated upstream
              onClick={() => setNNumber('')}
=======
              onClick={() => {
                setNNumber('');
                setError(null);
              }}
>>>>>>> Stashed changes
              className="p-2 text-gray-500 hover:text-gray-700 focus:outline-none"
              aria-label="Clear N-Number"
            >
              <X size={20} />
            </button>
          )}

          {/* Search Button */}
          <button
<<<<<<< Updated upstream
            onClick={onSearch}
            disabled={!nNumber}
            className="px-4 py-2 bg-blue-500 text-white rounded-md
                     hover:bg-blue-600 focus:outline-none focus:ring-2
                     focus:ring-blue-500 focus:ring-offset-2
                     disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Search
          </button>
        </div>
      </div>
=======
            onClick={handleSearch}
            disabled={!nNumber || isLoading}
            className={`px-4 py-2 text-white rounded-md focus:outline-none 
                       focus:ring-2 focus:ring-offset-2
                       ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500'}
                       disabled:bg-gray-300 disabled:cursor-not-allowed`}
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* ✅ Show Error Messages */}
      {error && <p className="text-red-500 text-sm">{error}</p>}

>>>>>>> Stashed changes
      <p className="text-sm text-gray-500">
        Enter the N-Number without the 'N' prefix (e.g., '12345' for N12345)
      </p>
    </div>
  );
};

<<<<<<< Updated upstream
export default NNumberSelector;
=======
export default React.memo(NNumberSelector); // ✅ Prevent unnecessary re-renders
>>>>>>> Stashed changes
