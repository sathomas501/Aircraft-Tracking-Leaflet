// QuotaIndicator.tsx - Component to display API quota usage
import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface QuotaIndicatorProps {
  quotaUsage: {
    used: number;
    total: number;
  };
}

const QuotaIndicator: React.FC<QuotaIndicatorProps> = ({ quotaUsage }) => {
  const { used, total } = quotaUsage;
  const usagePercent = Math.round((used / total) * 100);

  // Determine color based on usage
  let barColor = 'bg-green-500';
  let textColor = 'text-green-700';

  if (usagePercent > 90) {
    barColor = 'bg-red-500';
    textColor = 'text-red-700';
  } else if (usagePercent > 70) {
    barColor = 'bg-yellow-500';
    textColor = 'text-yellow-700';
  } else if (usagePercent > 50) {
    barColor = 'bg-blue-500';
    textColor = 'text-blue-700';
  }

  return (
    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-700">API Quota</span>
        <span className={`text-xs font-medium ${textColor}`}>
          {used}/{total} ({usagePercent}%)
        </span>
      </div>

      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full`}
          style={{ width: `${Math.min(usagePercent, 100)}%` }}
        />
      </div>

      {usagePercent > 90 && (
        <div className="mt-1 flex items-center text-xs text-red-700">
          <AlertTriangle size={12} className="mr-1" />
          <span>Quota nearly depleted</span>
        </div>
      )}
    </div>
  );
};

export default QuotaIndicator;
