// lib/hooks/useUIState.ts
import { create } from 'zustand';

interface UIState {
  // Panel visibility
  infoPanelVisible: boolean;
  selectedAircraftId: string | null;

  // UI state
  isLoading: boolean;
  isUpdating: boolean;

  // Actions
  selectAircraft: (id: string | null) => void;
  showInfoPanel: (visible: boolean) => void;
  setLoading: (loading: boolean) => void;
  setUpdating: (updating: boolean) => void;
}

export const useUIState = create<UIState>((set) => ({
  infoPanelVisible: false,
  selectedAircraftId: null,
  isLoading: false,
  isUpdating: false,

  selectAircraft: (id) => set({ selectedAircraftId: id }),
  showInfoPanel: (visible) => set({ infoPanelVisible: visible }),
  setLoading: (loading) => set({ isLoading: loading }),
  setUpdating: (updating) => set({ isUpdating: updating }),
}));
