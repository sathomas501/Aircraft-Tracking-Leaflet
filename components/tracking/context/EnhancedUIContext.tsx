// components/shared/context/EnhancedUIContext.tsx
import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  ReactNode,
  useEffect,
} from 'react';
import { ExtendedAircraft } from '@/types/base';
import openSkyTrackingService from '../../../lib/services/openSkyTrackingService';

// Define UI element types
export type PanelType =
  | 'aircraftInfo'
  | 'settings'
  | 'filters'
  | 'details'
  | 'custom';

// Trail settings interface
export interface TrailSettings {
  enabled: boolean;
  maxTrailLength: number;
  fadeTime: number;
  selectedOnly: boolean;
}

interface PanelState {
  isOpen: boolean;
  type: PanelType;
  position: { x: number; y: number };
  data?: any;
  title?: string;
  customContent?: ReactNode;
}

interface TooltipState {
  isOpen: boolean;
  content: ReactNode | null;
  position: { x: number; y: number } | null;
  targetId: string | null;
}

// Define context state
interface EnhancedUIContextState {
  // Panels state
  panels: Record<PanelType, PanelState>;
  openPanel: (
    type: PanelType,
    data?: any,
    position?: { x: number; y: number },
    title?: string
  ) => void;
  closePanel: (type: PanelType) => void;
  setPanelPosition: (
    type: PanelType,
    position: { x: number; y: number }
  ) => void;
  setCustomPanelContent: (
    content: ReactNode,
    title?: string,
    position?: { x: number; y: number }
  ) => void;

  // Selected aircraft state (previously in map context)
  selectedAircraft: ExtendedAircraft | null;
  selectAircraft: (aircraft: ExtendedAircraft | null) => void;

  // Tooltip state
  tooltip: TooltipState;
  showTooltip: (
    content: ReactNode,
    targetId: string,
    position: { x: number; y: number } | null
  ) => void;
  hideTooltip: () => void;

  // Trail settings
  trailSettings: TrailSettings;
  updateTrailSettings: (settings: Partial<TrailSettings>) => void;
  toggleTrails: () => void;

  // Other UI state
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  errorMessage: string | null;
  setErrorMessage: (message: string | null) => void;
}

// Create the context
const EnhancedUIContext = createContext<EnhancedUIContextState | undefined>(
  undefined
);

// Default panel positions with fallback values for server-side rendering
const DEFAULT_POSITIONS = {
  aircraftInfo: {
    x: typeof window !== 'undefined' ? window.innerWidth - 300 : 700,
    y: 20,
  },
  settings: { x: 20, y: 20 },
  filters: { x: 20, y: 20 },
  details: {
    x: typeof window !== 'undefined' ? window.innerWidth / 2 - 300 : 400,
    y: 50,
  },
  custom: {
    x: typeof window !== 'undefined' ? window.innerWidth / 2 - 200 : 300,
    y: 100,
  },
};

// Default trail settings
const DEFAULT_TRAIL_SETTINGS: TrailSettings = {
  enabled: false,
  maxTrailLength: 100,
  fadeTime: 30, // minutes
  selectedOnly: false,
};

// Provider component
export const EnhancedUIProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // Panels state
  const [panels, setPanels] = useState<Record<PanelType, PanelState>>({
    aircraftInfo: {
      isOpen: false,
      type: 'aircraftInfo',
      position: DEFAULT_POSITIONS.aircraftInfo,
      data: null,
    },
    settings: {
      isOpen: false,
      type: 'settings',
      position: DEFAULT_POSITIONS.settings,
      data: null,
    },
    filters: {
      isOpen: false,
      type: 'filters',
      position: DEFAULT_POSITIONS.filters,
      data: null,
    },
    details: {
      isOpen: false,
      type: 'details',
      position: DEFAULT_POSITIONS.details,
      data: null,
    },
    custom: {
      isOpen: false,
      type: 'custom',
      position: DEFAULT_POSITIONS.custom,
      data: null,
      customContent: null,
    },
  });

  // Selected aircraft state
  const [selectedAircraft, setSelectedAircraft] =
    useState<ExtendedAircraft | null>(null);

  // Tooltip state
  const [tooltip, setTooltip] = useState<TooltipState>({
    isOpen: false,
    content: null,
    position: null,
    targetId: null,
  });

  // Initialize trail settings from the tracking service
  const [trailSettings, setTrailSettings] = useState<TrailSettings>({
    ...DEFAULT_TRAIL_SETTINGS,
    enabled: openSkyTrackingService.areTrailsEnabled(),
    maxTrailLength: openSkyTrackingService.getMaxTrailLength(),
  });

  // Sync with tracking service on mount
  useEffect(() => {
    // Set initial trail settings from service
    setTrailSettings((prev) => ({
      ...prev,
      enabled: openSkyTrackingService.areTrailsEnabled(),
      maxTrailLength: openSkyTrackingService.getMaxTrailLength(),
    }));
  }, []);

  // Other UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Panel actions
  const openPanel = useCallback(
    (
      type: PanelType,
      data?: any,
      position?: { x: number; y: number },
      title?: string
    ) => {
      setPanels((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          isOpen: true,
          data: data || prev[type].data,
          position: position || prev[type].position,
          title: title || prev[type].title,
        },
      }));
    },
    []
  );

  const closePanel = useCallback((type: PanelType) => {
    setPanels((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        isOpen: false,
      },
    }));
  }, []);

  const setPanelPosition = useCallback(
    (type: PanelType, position: { x: number; y: number }) => {
      setPanels((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          position,
        },
      }));
    },
    []
  );

  const setCustomPanelContent = useCallback(
    (
      content: ReactNode,
      title?: string,
      position?: { x: number; y: number }
    ) => {
      setPanels((prev) => ({
        ...prev,
        custom: {
          ...prev.custom,
          isOpen: true,
          customContent: content,
          title: title || prev.custom.title,
          position: position || prev.custom.position,
        },
      }));
    },
    []
  );

  // Aircraft selection action
  const selectAircraft = useCallback(
    (aircraft: ExtendedAircraft | null) => {
      setSelectedAircraft(aircraft);

      // Automatically open/close aircraft info panel
      if (aircraft) {
        openPanel('aircraftInfo', aircraft);
      } else {
        closePanel('aircraftInfo');
      }
    },
    [openPanel, closePanel]
  );

  // Tooltip actions
  const showTooltip = useCallback(
    (
      content: ReactNode,
      targetId: string,
      position: { x: number; y: number } | null = null
    ) => {
      setTooltip({
        isOpen: true,
        content,
        targetId,
        position,
      });
    },
    []
  );

  const hideTooltip = useCallback(() => {
    setTooltip((prev) => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  // Trail settings actions
  const updateTrailSettings = useCallback(
    (settings: Partial<TrailSettings>) => {
      setTrailSettings((prev) => {
        const newSettings = {
          ...prev,
          ...settings,
        };

        // Update the tracking service with new settings
        if (settings.maxTrailLength !== undefined) {
          openSkyTrackingService.setMaxTrailLength(settings.maxTrailLength);
        }

        return newSettings;
      });
    },
    []
  );

  const toggleTrails = useCallback(() => {
    setTrailSettings((prev) => {
      const enabled = !prev.enabled;

      // Update the tracking service
      openSkyTrackingService.setTrailsEnabled(enabled);

      // If enabling trails, force generate them
      if (enabled) {
        openSkyTrackingService.forceGenerateTrails();
      }

      return {
        ...prev,
        enabled,
      };
    });
  }, []);

  const value = {
    panels,
    openPanel,
    closePanel,
    setPanelPosition,
    setCustomPanelContent,
    selectedAircraft,
    selectAircraft,
    tooltip,
    showTooltip,
    hideTooltip,
    trailSettings,
    updateTrailSettings,
    toggleTrails,
    isLoading,
    setIsLoading,
    errorMessage,
    setErrorMessage,
  };

  return (
    <EnhancedUIContext.Provider value={value}>
      {children}
    </EnhancedUIContext.Provider>
  );
};

// Custom hook to use the context
export const useEnhancedUI = () => {
  const context = useContext(EnhancedUIContext);
  if (context === undefined) {
    throw new Error('useEnhancedUI must be used within an EnhancedUIProvider');
  }
  return context;
};
