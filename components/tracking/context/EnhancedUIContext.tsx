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

// Define UI element types
export type PanelType =
  | 'aircraftInfo'
  | 'settings'
  | 'filters'
  | 'details'
  | 'custom';

// Define position type
export interface PanelPosition {
  x: number;
  y: number;
}

// Fixed PanelState interface
interface PanelState {
  isOpen: boolean;
  type: PanelType;
  position: PanelPosition;
  data?: any;
  title?: string;
  customContent?: ReactNode;
}

// Define multiple panels state type
interface PanelsState {
  [key: string]: PanelState;
}

interface TooltipState {
  isOpen: boolean;
  content: ReactNode | null;
  position: PanelPosition | null;
  targetId: string | null;
}

interface EnhancedUIContextType {
  selectAircraft: (aircraft: ExtendedAircraft | null) => void;
  openPanel: (
    panelId: PanelType,
    data: any,
    position: PanelPosition,
    title: string
  ) => void;
  closePanel: (panelId: PanelType) => void;
  panels: PanelsState;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

// Define context state
interface EnhancedUIContextState {
  // Panels state
  panels: Record<PanelType, PanelState>;
  openPanel: (
    type: PanelType,
    data?: any,
    position?: PanelPosition,
    title?: string
  ) => void;
  closePanel: (type: PanelType) => void;
  setPanelPosition: (type: PanelType, position: PanelPosition) => void;
  setCustomPanelContent: (
    content: ReactNode,
    title?: string,
    position?: PanelPosition
  ) => void;

  // Selected aircraft state (previously in map context)
  selectedAircraft: ExtendedAircraft | null;
  selectAircraft: (aircraft: ExtendedAircraft | null) => void;

  // Tooltip state
  tooltip: TooltipState;
  showTooltip: (
    content: ReactNode,
    targetId: string,
    position: PanelPosition | null
  ) => void;
  hideTooltip: () => void;

  // Other UI state
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  errorMessage: string | null;
  setErrorMessage: (message: string | null) => void;
}

// Create the context
const EnhancedUIContext = createContext<EnhancedUIContextType>({
  selectAircraft: () => {},
  openPanel: () => {},
  closePanel: () => {},
  panels: {} as PanelsState,
  isLoading: false,
  setIsLoading: () => {},
});

// Default panel state
const defaultPanelState: PanelState = {
  isOpen: false,
  type: 'custom', // Default type
  position: { x: 0, y: 0 },
  data: null,
  title: '',
};

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

  // Other UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Panel actions
  const openPanel = useCallback(
    (type: PanelType, data?: any, position?: PanelPosition, title?: string) => {
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
    (type: PanelType, position: PanelPosition) => {
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
    (content: ReactNode, title?: string, position?: PanelPosition) => {
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
      position: PanelPosition | null = null
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

  const value = {
    // Providing the correct types to match EnhancedUIContextType
    selectAircraft,
    openPanel: openPanel as (
      panelId: PanelType,
      data: any,
      position: PanelPosition,
      title: string
    ) => void,
    closePanel,
    panels: panels as PanelsState,
    isLoading,
    setIsLoading,
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
