// components/tracking/context/AircraftUIStateManager.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import {
  AircraftUIState,
  loadAircraftUIState,
  saveAircraftUIState,
  createEmptyUIState,
  updatePopupState as updateStoredPopup,
  updateMarkerHighlight as updateStoredHighlight,
  updateLastViewedDetails as updateStoredLastViewed,
  updatePanelExpansion as updateStoredPanel,
  clearAircraftUIState,
  isUIStateRecent,
} from '../persistence/AircraftUIStatePersistence';

// Define context interface
interface UIStateContextType {
  // State getters
  openPopups: string[];
  highlightedMarkers: string[];
  lastViewedDetails: string | null;

  // State updaters
  setPopupOpen: (icao: string, isOpen: boolean) => void;
  setMarkerHighlighted: (icao: string, isHighlighted: boolean) => void;
  setLastViewedDetails: (icao: string | null) => void;
  setPanelExpanded: (
    icao: string,
    panelKey: string,
    isExpanded: boolean
  ) => void;
  isPanelExpanded: (icao: string, panelKey: string) => boolean;

  // Bulk operations
  isPopupOpen: (icao: string) => boolean;
  isMarkerHighlighted: (icao: string) => boolean;

  // Reset operations
  clearAllUIState: () => void;
  clearPopups: () => void;
  clearHighlights: () => void;

  // Debug info
  lastUpdated: number | null;
}

// Create context
const UIStateContext = createContext<UIStateContextType | undefined>(undefined);

// Provider component
export const AircraftUIStateProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // State
  const [uiState, setUIState] = useState<AircraftUIState>(createEmptyUIState());
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [initialized, setInitialized] = useState<boolean>(false);

  // Load data on initial mount
  useEffect(() => {
    // Only run this in the browser, not during SSR
    if (typeof window === 'undefined') {
      return;
    }

    // Load saved UI state
    const savedState = loadAircraftUIState();

    // Only restore if we have state and it's recent (< 1 hour old)
    if (savedState && isUIStateRecent()) {
      setUIState(savedState);
      setLastUpdated(savedState.lastUpdated);
      console.log(
        `[UIState] Restored UI state with ${savedState.openPopups.length} popups and ${savedState.highlightedMarkers.length} highlights`
      );
    } else {
      // Otherwise initialize with empty state
      setUIState(createEmptyUIState());
    }

    setInitialized(true);
  }, []);

  // Update storage when state changes (but only after initial load)
  useEffect(() => {
    if (!initialized) return;

    saveAircraftUIState(uiState);
    setLastUpdated(uiState.lastUpdated);
  }, [uiState, initialized]);

  // Set popup open/closed
  const setPopupOpen = useCallback((icao: string, isOpen: boolean) => {
    setUIState((prevState) => {
      const newOpenPopups = isOpen
        ? [...new Set([...prevState.openPopups, icao])]
        : prevState.openPopups.filter((id) => id !== icao);

      // Only update if there's a change
      if (
        (isOpen && prevState.openPopups.includes(icao)) ||
        (!isOpen && !prevState.openPopups.includes(icao))
      ) {
        return prevState;
      }

      // Also update in storage directly for redundancy
      updateStoredPopup(icao, isOpen);

      return {
        ...prevState,
        openPopups: newOpenPopups,
        lastUpdated: Date.now(),
      };
    });
  }, []);

  // Set marker highlighted
  const setMarkerHighlighted = useCallback(
    (icao: string, isHighlighted: boolean) => {
      setUIState((prevState) => {
        const newHighlightedMarkers = isHighlighted
          ? [...new Set([...prevState.highlightedMarkers, icao])]
          : prevState.highlightedMarkers.filter((id) => id !== icao);

        // Only update if there's a change
        if (
          (isHighlighted && prevState.highlightedMarkers.includes(icao)) ||
          (!isHighlighted && !prevState.highlightedMarkers.includes(icao))
        ) {
          return prevState;
        }

        // Also update in storage directly for redundancy
        updateStoredHighlight(icao, isHighlighted);

        return {
          ...prevState,
          highlightedMarkers: newHighlightedMarkers,
          lastUpdated: Date.now(),
        };
      });
    },
    []
  );

  // Set last viewed details
  const setLastViewedDetails = useCallback((icao: string | null) => {
    setUIState((prevState) => {
      // Only update if there's a change
      if (prevState.lastViewedDetails === icao) {
        return prevState;
      }

      // Also update in storage directly for redundancy
      updateStoredLastViewed(icao);

      return {
        ...prevState,
        lastViewedDetails: icao,
        lastUpdated: Date.now(),
      };
    });
  }, []);

  // Set panel expanded
  const setPanelExpanded = useCallback(
    (icao: string, panelKey: string, isExpanded: boolean) => {
      setUIState((prevState) => {
        const key = `${icao}:${panelKey}`;

        // Only update if there's a change
        if (prevState.expandedPanels[key] === isExpanded) {
          return prevState;
        }

        // Also update in storage directly for redundancy
        updateStoredPanel(icao, panelKey, isExpanded);

        return {
          ...prevState,
          expandedPanels: {
            ...prevState.expandedPanels,
            [key]: isExpanded,
          },
          lastUpdated: Date.now(),
        };
      });
    },
    []
  );

  // Check if panel is expanded
  const isPanelExpanded = useCallback(
    (icao: string, panelKey: string) => {
      const key = `${icao}:${panelKey}`;
      return uiState.expandedPanels[key] || false;
    },
    [uiState.expandedPanels]
  );

  // Check if popup is open
  const isPopupOpen = useCallback(
    (icao: string) => {
      return uiState.openPopups.includes(icao);
    },
    [uiState.openPopups]
  );

  // Check if marker is highlighted
  const isMarkerHighlighted = useCallback(
    (icao: string) => {
      return uiState.highlightedMarkers.includes(icao);
    },
    [uiState.highlightedMarkers]
  );

  // Clear all UI state
  const clearAllUIState = useCallback(() => {
    clearAircraftUIState();
    setUIState(createEmptyUIState());
    console.log('[UIState] Cleared all UI state');
  }, []);

  // Clear popups
  const clearPopups = useCallback(() => {
    setUIState((prevState) => ({
      ...prevState,
      openPopups: [],
      lastUpdated: Date.now(),
    }));
  }, []);

  // Clear highlights
  const clearHighlights = useCallback(() => {
    setUIState((prevState) => ({
      ...prevState,
      highlightedMarkers: [],
      lastUpdated: Date.now(),
    }));
  }, []);

  // Create context value
  const contextValue: UIStateContextType = {
    // State getters
    openPopups: uiState.openPopups,
    highlightedMarkers: uiState.highlightedMarkers,
    lastViewedDetails: uiState.lastViewedDetails,

    // State updaters
    setPopupOpen,
    setMarkerHighlighted,
    setLastViewedDetails,
    setPanelExpanded,
    isPanelExpanded,

    // Bulk operations
    isPopupOpen,
    isMarkerHighlighted,

    // Reset operations
    clearAllUIState,
    clearPopups,
    clearHighlights,

    // Debug info
    lastUpdated,
  };

  return (
    <UIStateContext.Provider value={contextValue}>
      {children}
    </UIStateContext.Provider>
  );
};

// Custom hook to use the context
export const useAircraftUIState = () => {
  const context = useContext(UIStateContext);
  if (context === undefined) {
    throw new Error(
      'useAircraftUIState must be used within an AircraftUIStateProvider'
    );
  }
  return context;
};

export default UIStateContext;
