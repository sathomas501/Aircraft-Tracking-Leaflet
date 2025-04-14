import React from 'react';

interface HeaderProps {
  aircraft: number;
}

export const Header: React.FC<HeaderProps> = ({ aircraft }) => {
  return (
    <header className="bg-white shadow-sm">
      <div className="container mx-auto px-4 py-4">
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
  );
};