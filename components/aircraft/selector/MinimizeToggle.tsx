import React from 'react';
import { Plane, Minus, X } from 'lucide-react';

interface MinimizeToggleProps {
  isMinimized: boolean;
  onToggle: () => void;
}

const MinimizeToggle: React.FC<MinimizeToggleProps> = ({ isMinimized, onToggle }) => (
  <button onClick={onToggle} className="text-gray-400 hover:text-gray-600 p-1">
    {isMinimized ? <Plane size={20} /> : <Minus size={20} />}
  </button>
);

export default MinimizeToggle;
