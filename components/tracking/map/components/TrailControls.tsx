// components/tracking/map/controls/TrailControls.tsx
import React, { useState, useEffect } from 'react';
import EnhancedTooltip from '../../map/components/AircraftTooltip';
import { useEnhancedUI } from '../../context/EnhancedUIContext';
import openSkyTrackingService from '../../../../lib/services/openSkyTrackingService';

interface TrailControlsProps {
  enabled: boolean;
  onToggle: () => void;
  onSettingsChange: (settings: TrailSettings) => void;
}

export interface TrailSettings {
  maxTrailLength: number;
  fadeTime: number;
  selectedOnly: boolean;
}

const TrailControls: React.FC<TrailControlsProps> = ({
  enabled,
  onToggle,
  onSettingsChange,
}) => {
  const { openPanel, closePanel } = useEnhancedUI();
  const [settings, setSettings] = useState<TrailSettings>({
    maxTrailLength: 100,
    fadeTime: 30,
    selectedOnly: false,
  });

  // Initialize settings from the tracking service on mount
  useEffect(() => {
    setSettings((prevSettings) => ({
      ...prevSettings,
      maxTrailLength: openSkyTrackingService.getMaxTrailLength(),
    }));
  }, []);

  // Handle toggling the trails
  const handleToggle = () => {
    onToggle();
  };

  // Handle opening the settings panel
  const handleOpenSettings = () => {
    // Using fixed/explicit position rather than undefined
    openPanel('custom', settings, { x: 300, y: 100 }, 'Trail Settings');
  };

  // Handle change of settings
  const handleSettingChange = (
    key: keyof TrailSettings,
    value: number | boolean
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onSettingsChange(newSettings);
  };

  // Handle force generate trails
  const handleForceGenerateTrails = () => {
    if (enabled) {
      openSkyTrackingService.forceGenerateTrails();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <EnhancedTooltip
        content={enabled ? 'Disable Trails' : 'Enable Trails'}
        position="left"
      >
        <button
          onClick={handleToggle}
          className={`p-2 rounded-full shadow-md hover:bg-gray-100 ${
            enabled
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-white text-gray-700'
          }`}
          aria-label={enabled ? 'Disable Trails' : 'Enable Trails'}
        >
          {/* Trail icon - you can replace with SVG or emoji */}
          <span className="text-sm">🛫</span>
        </button>
      </EnhancedTooltip>

      {enabled && (
        <>
          <EnhancedTooltip content="Trail Settings" position="left">
            <button
              onClick={handleOpenSettings}
              className="bg-white p-2 rounded-full shadow-md hover:bg-gray-100"
              aria-label="Trail Settings"
            >
              {/* Settings icon - you can replace with SVG or emoji */}
              <span className="text-sm">⚙️</span>
            </button>
          </EnhancedTooltip>

          <EnhancedTooltip content="Force Generate Trails" position="left">
            <button
              onClick={handleForceGenerateTrails}
              className="bg-white p-2 rounded-full shadow-md hover:bg-gray-100"
              aria-label="Force Generate Trails"
            >
              {/* Refresh icon - you can replace with SVG or emoji */}
              <span className="text-sm">🔄</span>
            </button>
          </EnhancedTooltip>
        </>
      )}

      {/* Trail Settings Panel - This will be rendered using our DraggablePanel through the EnhancedUIContext */}
      <TrailSettingsPanel
        settings={settings}
        onSettingChange={handleSettingChange}
      />
    </div>
  );
};

// This component will be mounted via the EnhancedUIContext's custom panel
const TrailSettingsPanel: React.FC<{
  settings: TrailSettings;
  onSettingChange: (key: keyof TrailSettings, value: number | boolean) => void;
}> = ({ settings, onSettingChange }) => {
  return (
    <div className="w-64">
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700">
          Trail Length
        </label>
        <div className="flex items-center mt-1">
          <input
            type="range"
            min="10"
            max="500"
            step="10"
            value={settings.maxTrailLength}
            onChange={(e) =>
              onSettingChange('maxTrailLength', parseInt(e.target.value))
            }
            className="flex-grow mr-2"
          />
          <span className="text-sm w-10 text-right">
            {settings.maxTrailLength}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700">
          Fade Time (minutes)
        </label>
        <div className="flex items-center mt-1">
          <input
            type="range"
            min="5"
            max="120"
            step="5"
            value={settings.fadeTime}
            onChange={(e) =>
              onSettingChange('fadeTime', parseInt(e.target.value))
            }
            className="flex-grow mr-2"
          />
          <span className="text-sm w-10 text-right">{settings.fadeTime}</span>
        </div>
      </div>

      <div className="mb-2">
        <label className="flex items-center text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={settings.selectedOnly}
            onChange={(e) => onSettingChange('selectedOnly', e.target.checked)}
            className="mr-2"
          />
          Selected Aircraft Only
        </label>
      </div>

      {/* Add Generate Mock Trails button */}
      <div className="mt-4">
        <button
          onClick={() => openSkyTrackingService.forceGenerateTrails()}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-1.5 px-3 rounded text-sm transition-colors"
        >
          Generate Trails
        </button>
      </div>
    </div>
  );
};

export default TrailControls;
