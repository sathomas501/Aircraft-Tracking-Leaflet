import React from 'react';
import { Minus, Plus } from 'lucide-react';

interface MinimizeToggleProps {
  isMinimized: boolean;
  onToggle: () => void;
}

const MinimizeToggle: React.FC<MinimizeToggleProps> = ({
  isMinimized,
  onToggle,
}) => (
  <button
    onClick={onToggle}
    className="fixed top-[10px] right-[10px] z-[4000] bg-white rounded-lg shadow-md px-3 py-2 text-gray-700 hover:bg-gray-50"
  >
    {isMinimized ? <Plus size={16} /> : <Minus size={16} />}
  </button>
);

export default MinimizeToggle;
