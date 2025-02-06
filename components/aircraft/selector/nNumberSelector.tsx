import React from 'react';
import { X, Plane } from 'lucide-react';

interface NNumberSelectorProps {
  nNumber: string;
  setNNumber: (nNumber: string) => void;
  onSearch: () => void;
}

const NNumberSelector: React.FC<NNumberSelectorProps> = ({ nNumber, setNNumber, onSearch }) => {
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
            />
            <Plane className="absolute left-2 top-2.5 text-gray-400" size={16} />
          </div>

          {/* Clear Button */}
          {nNumber && (
            <button
              onClick={() => setNNumber('')}
              className="p-2 text-gray-500 hover:text-gray-700 focus:outline-none"
              aria-label="Clear N-Number"
            >
              <X size={20} />
            </button>
          )}

          {/* Search Button */}
          <button
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
      <p className="text-sm text-gray-500">
        Enter the N-Number without the 'N' prefix (e.g., '12345' for N12345)
      </p>
    </div>
  );
};

export default NNumberSelector;
