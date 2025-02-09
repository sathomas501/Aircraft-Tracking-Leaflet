import React, { useState } from 'react';
import { X, Plane } from 'lucide-react';

interface NNumberSelectorProps {
  nNumber: string;
  setNNumber: (nNumber: string) => void;
  onSearch: (nNumber: string) => void;
}

const NNumberSelector: React.FC<NNumberSelectorProps> = ({
  nNumber,
  setNNumber,
  onSearch,
}) => {
  const [error, setError] = useState<string | null>(null);

  const handleSearch = () => {
    if (!nNumber.trim()) return;
    if (nNumber.length < 3) {
      setError('N-Number must be at least 3 characters long.');
      return;
    }

    setError(null);
    onSearch(nNumber);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-600">
        N-Number
      </label>
      <div className="relative flex space-x-2">
        <input
          type="text"
          value={nNumber}
          onChange={(e) => setNNumber(e.target.value.toUpperCase())}
          placeholder="Enter N-Number..."
          className="w-full p-2 pl-8 border border-gray-300 rounded-md shadow-sm"
          maxLength={6}
        />
        <Plane className="absolute left-2 top-2.5 text-gray-400" size={16} />
        {nNumber && (
          <button onClick={() => setNNumber('')} className="text-gray-500">
            <X size={20} />
          </button>
        )}
        <button
          onClick={handleSearch}
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
        >
          Search
        </button>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );
};

export default React.memo(NNumberSelector);
