// NotificationBar.tsx - Component to display API notifications
import React from 'react';
import { Info, AlertCircle, Clock } from 'lucide-react';

interface NotificationBarProps {
  notification: string | null;
  lastUpdated: string | null;
  type?: 'info' | 'warning' | 'error';
}

const NotificationBar: React.FC<NotificationBarProps> = ({
  notification,
  lastUpdated,
  type = 'info',
}) => {
  if (!notification) return null;

  // Define icon and colors based on type
  let Icon = Info;
  let bgColor = 'bg-blue-50';
  let textColor = 'text-blue-700';
  let borderColor = 'border-blue-200';

  if (type === 'warning') {
    Icon = AlertCircle;
    bgColor = 'bg-yellow-50';
    textColor = 'text-yellow-700';
    borderColor = 'border-yellow-200';
  } else if (type === 'error') {
    Icon = AlertCircle;
    bgColor = 'bg-red-50';
    textColor = 'text-red-700';
    borderColor = 'border-red-200';
  }

  return (
    <div
      className={`px-4 py-2 ${bgColor} ${textColor} ${borderColor} border rounded-md mb-2 flex items-center justify-between`}
    >
      <div className="flex items-center">
        <Icon size={16} className="mr-2" />
        <span>{notification}</span>
      </div>

      {lastUpdated && (
        <div className="flex items-center text-sm opacity-75">
          <Clock size={14} className="mr-1" />
          <span>Updated: {lastUpdated}</span>
        </div>
      )}
    </div>
  );
};

export default NotificationBar;
