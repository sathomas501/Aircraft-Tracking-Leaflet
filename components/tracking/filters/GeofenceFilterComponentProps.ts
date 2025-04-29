// components/tracking/filters/GeofenceFilterComponentProps.ts

// Define the coordinate interface for reuse
export interface Coordinates {
  lat: number;
  lng: number;
}

// Define the panel position interface for floating panels
export interface PanelPosition {
  x: number;
  y: number;
}

// Define the props interface for the GeofenceFilterComponent
export interface GeofenceFilterComponentProps {
  // State props
  isGeofenceActive: boolean;
  geofenceLocation: string;
  geofenceRadius: number;
  geofenceCoordinates: Coordinates | null;
  isGettingLocation: boolean;
  hasError: string | null;
  
  // Event handlers
  onLocationChange: (value: string) => void;
  onRadiusChange: (value: number) => void;
  onSearch: () => void;
  onGetLocation: () => void;
  onToggleChange: (enabled: boolean) => void;
}

// Define the props interface for the FloatingGeofencePanel
export interface FloatingGeofencePanelProps {
  isOpen: boolean;
  panelPosition: PanelPosition;
  geofenceRadius: number;
  isGeofenceActive: boolean;
  tempCoordinates: Coordinates | null;
  locationName: string | null;
  isLoadingLocation: boolean;
  isSearching: boolean;
  hasError: string | null;
  
  onClose: () => void;
  onReset: () => void;
  onRadiusChange: (radius: number) => void;
  onSearch: (lat: number, lng: number) => void;
  onPositionUpdate: (position: PanelPosition) => void;
}

// Define the options interface for the GeofencePanel hook
export interface GeofencePanelOptions {
  geofenceRadius: number;
  mapInstance: any; // Replace with your map type if available
  isGeofenceActive: boolean;
  toggleGeofenceState: (enabled: boolean) => void;
  setActiveDropdown: (dropdown: string | null) => void;
  updateGeofenceAircraft: (aircraft: any[]) => void;
  setGeofenceCenter?: (coords: Coordinates) => void;
  setGeofenceCoordinates?: (coords: Coordinates | null) => void;
  processGeofenceSearch?: (fromPanel?: boolean) => Promise<void> | void;
  setCoordinates?: (position: PanelPosition) => void;
  setShowPanel?: (show: boolean) => void;
  onClose?: () => void;
  onReset?: () => void;
}