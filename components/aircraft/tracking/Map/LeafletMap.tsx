import React, { Component, createRef } from 'react';
import type { ExtendedAircraft } from '@/types/base';
import { MAP_CONFIG } from '@/config/map';
import {
  createAircraftIcon,
  createTooltipContent,
  createPopupContent,
  getOwnerTypeLabel,
} from '../Map/components/AircraftIcon/AircraftIcon';
import openSkyTrackingService from '@/lib/services/openSkyTrackingService';

interface LeafletMapProps {
  aircraft: ExtendedAircraft[];
  onError: (message: string) => void;
  children?: React.ReactNode; // Add this line to accept children
  preserveView?: boolean;
}

interface LeafletMapState {
  selectedAircraft: ExtendedAircraft | null;
  currentZoom: number;
}

class LeafletMap extends Component<LeafletMapProps, LeafletMapState> {
  private mapRef = createRef<HTMLDivElement>();
  private infoRef = createRef<HTMLDivElement>();
  private map: any = null;
  private markerLayer: any = null;
  private leaflet: any = null;
  private markers: Map<string, any> = new Map(); // Store markers by icao24
  private isInitialized = false;
  private resizeObserver: ResizeObserver | null = null;
  private lastRefreshTime: number = 0;

  constructor(props: LeafletMapProps) {
    super(props);
    this.state = {
      selectedAircraft: null,
      currentZoom: MAP_CONFIG.DEFAULT_ZOOM,
    };
  }

  getMapInstance() {
    return this.map;
  }

  // Create a ref to expose this method
  mapInstanceRef = createRef<{ getMapInstance?: () => any }>();

  componentDidMount() {
    this.initializeMap();

    // Expose the getMapInstance method
    if (this.mapInstanceRef.current) {
      this.mapInstanceRef.current.getMapInstance =
        this.getMapInstance.bind(this);
    }

    if (typeof openSkyTrackingService.refreshPositionsOnly === 'function') {
      openSkyTrackingService.refreshPositionsOnly(true);
      this.lastRefreshTime = Date.now();
    }

    // Set up resize observer for the map container
    if (this.mapRef.current) {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.map) {
          this.map.invalidateSize();
          this.updateMarkersForZoom(this.state.currentZoom);
        }
      });
      this.resizeObserver.observe(this.mapRef.current);
    }
  }

  componentDidUpdate(prevProps: LeafletMapProps, prevState: LeafletMapState) {
    if (prevProps.aircraft !== this.props.aircraft) {
      if (!this.isInitialized) {
        this.initializeMap(); // Initialize only if needed
      }
      this.updateAircraftMarkers();
    }

    // Update markers if zoom level changed
    if (prevState.currentZoom !== this.state.currentZoom) {
      this.updateMarkersForZoom(this.state.currentZoom);
    }
  }

  componentWillUnmount() {
    console.log('[LeafletMap] Component unmounting...');

    // Clean up the global reference
    if (
      typeof window !== 'undefined' &&
      (window as any).__leafletMapInstance === this.map
    ) {
      (window as any).__leafletMapInstance = null;
    }

    this.destroyMap();
  }

  async initializeMap() {
    try {
      if (!this.mapRef.current || this.map) {
        console.warn('[LeafletMap] Map already initialized, skipping...');
        return;
      }

      console.log('[LeafletMap] Initializing map...');

      // Dynamically import Leaflet
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      this.leaflet = L;

      // Create the map instance
      this.map = L.map(this.mapRef.current, {
        center: MAP_CONFIG.CENTER,
        zoom: MAP_CONFIG.DEFAULT_ZOOM,
        minZoom: MAP_CONFIG.OPTIONS.minZoom,
        maxZoom: MAP_CONFIG.OPTIONS.maxZoom,
        preferCanvas: true,
        worldCopyJump: true,
      });

      // Add this line to expose the map instance globally for the MapController
      // Note: This is a temporary solution for development; in production you'd want
      // a more elegant approach like React refs or context passing
      if (typeof window !== 'undefined') {
        (window as any).__leafletMapInstance = this.map;
      }

      // Set up base layers
      const layers = {
        Topographic: L.tileLayer(
          'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
          { attribution: '© OpenTopoMap contributors', maxZoom: 17 }
        ),
        Streets: L.tileLayer(
          'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          { attribution: '© OpenStreetMap contributors' }
        ),
        Satellite: L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          { attribution: '© Esri', maxZoom: 19 }
        ),
      };

      layers.Topographic.addTo(this.map);
      L.control.layers(layers).addTo(this.map);
      this.markerLayer = L.layerGroup().addTo(this.map);

      // Add click handler to map for deselecting aircraft
      this.map.on('click', this.handleMapClick);

      // Add zoom change handler
      this.map.on('zoomend', () => {
        this.setState({ currentZoom: this.map.getZoom() });
      });

      this.isInitialized = true;
      console.log('[LeafletMap] Map initialized successfully');

      // Update markers
      this.updateAircraftMarkers();
    } catch (error) {
      console.error('[LeafletMap] Failed to initialize map:', error);
      this.props.onError(
        `Failed to initialize map: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Update marker sizes and content based on zoom level
  updateMarkersForZoom(zoomLevel: number) {
    if (
      !this.map ||
      !this.markerLayer ||
      !this.leaflet ||
      !this.isInitialized
    ) {
      return;
    }

    // Update existing markers with new sizes and content
    for (const [icao24, marker] of this.markers.entries()) {
      const aircraft = this.props.aircraft.find((a) => a.icao24 === icao24);
      if (aircraft) {
        const isSelected = this.state.selectedAircraft?.icao24 === icao24;

        // Update icon to reflect zoom level
        marker.setIcon(
          createAircraftIcon(aircraft, {
            isSelected,
            zoomLevel,
          })
        );

        // Update popup content
        const popup = marker.getPopup();
        if (popup) {
          popup.setContent(createPopupContent(aircraft, zoomLevel));
        }

        // Update tooltip content
        const tooltip = marker.getTooltip();
        if (tooltip) {
          tooltip.setContent(createTooltipContent(aircraft, zoomLevel));

          // Show permanent tooltips for selected aircraft at higher zoom levels
          if (isSelected && zoomLevel > 8) {
            tooltip.options.permanent = true;
          } else {
            tooltip.options.permanent = false;
          }
        }
      }
    }
  }

  updateAircraftMarkers() {
    console.log('Updating markers, preserveView:', this.props.preserveView);
    if (
      !this.map ||
      !this.markerLayer ||
      !this.leaflet ||
      !this.isInitialized
    ) {
      return;
    }

    try {
      const L = this.leaflet;
      const { aircraft } = this.props;
      const currentZoom = this.state.currentZoom;

      console.log('[LeafletMap] Updating aircraft positions:', aircraft.length);

      // Track existing icao24 codes to know which to remove
      const currentIcao24s = new Set(aircraft.map((a) => a.icao24));

      // Remove markers that are no longer present
      for (const [icao24, marker] of this.markers.entries()) {
        if (!currentIcao24s.has(icao24)) {
          this.markerLayer.removeLayer(marker);
          this.markers.delete(icao24);
        }
      }

      // Filter valid aircraft
      const validAircraft = aircraft.filter(
        (plane) =>
          typeof plane.latitude === 'number' &&
          typeof plane.longitude === 'number' &&
          !isNaN(plane.latitude) &&
          !isNaN(plane.longitude)
      );

      // Add or update markers for each aircraft
      validAircraft.forEach((plane) => {
        const isSelected = this.state.selectedAircraft?.icao24 === plane.icao24;

        // Create or update marker
        if (this.markers.has(plane.icao24)) {
          // Update existing marker position
          const marker = this.markers.get(plane.icao24);
          marker.setLatLng([plane.latitude, plane.longitude]);

          // Update popup content
          const popup = marker.getPopup();
          if (popup) {
            popup.setContent(createPopupContent(plane, currentZoom));
          }

          // Update tooltip content
          const tooltip = marker.getTooltip();
          if (tooltip) {
            tooltip.setContent(createTooltipContent(plane, currentZoom));

            // Before fitting bounds:
            console.log('About to check bounds fitting:', {
              aircraftCount: validAircraft.length,
              hasSelection: !!this.state.selectedAircraft,
              preserveView: this.props.preserveView,
            });

            if (
              validAircraft.length > 0 &&
              !this.state.selectedAircraft &&
              !this.props.preserveView
            ) {
              console.log('FITTING BOUNDS NOW');
              // bounds fitting code...
            }

            // Update permanence based on selection and zoom
            if (isSelected && currentZoom > 8) {
              tooltip.options.permanent = true;
            } else {
              tooltip.options.permanent = false;
            }
          }

          // Update icon to reflect selection state and zoom level
          marker.setIcon(
            createAircraftIcon(plane, {
              isSelected,
              zoomLevel: currentZoom,
            })
          );
        } else {
          // Create new marker
          const marker = L.marker([plane.latitude, plane.longitude], {
            icon: createAircraftIcon(plane, {
              isSelected,
              zoomLevel: currentZoom,
            }),
            riseOnHover: true,
            zIndexOffset: isSelected ? 1000 : 0,
          });

          // Bind popup
          marker.bindPopup(createPopupContent(plane, currentZoom));

          // Bind tooltip
          marker.bindTooltip(createTooltipContent(plane, currentZoom), {
            direction: 'top',
            offset: [0, -12],
            opacity: 0.9,
            className: 'aircraft-tooltip',
            permanent: isSelected && currentZoom > 8,
          });

          // Add click handler
          marker.on('click', (e: any) => {
            L.DomEvent.stopPropagation(e);
            this.handleAircraftClick(plane);
          });

          // Store and add to layer
          this.markers.set(plane.icao24, marker);
          this.markerLayer.addLayer(marker);
        }
      });

      // Auto-fit bounds if we have aircraft and no selection
      if (
        validAircraft.length > 0 &&
        !this.state.selectedAircraft &&
        !this.props.preserveView
      ) {
        const bounds = L.latLngBounds(
          validAircraft.map((a) => [a.latitude, a.longitude])
        );
        this.map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 10, // Prevent too much zoom
        });
      }

      // Check if we're within 2 seconds of a refresh
      const timeSinceRefresh = Date.now() - this.lastRefreshTime;
      const isRecentlyRefreshed = timeSinceRefresh < 2000;

      console.log(
        'Map update - preserveView:',
        this.props.preserveView,
        'timeSinceRefresh:',
        timeSinceRefresh
      );

      if (
        validAircraft.length > 0 &&
        !this.state.selectedAircraft &&
        !this.props.preserveView &&
        typeof window !== 'undefined' &&
        !(window as any).__preventMapBoundsFit
      ) {
        // Fit bounds
      }

      // Only fit bounds if not in a refresh and not selected
      if (
        validAircraft.length > 0 &&
        !this.state.selectedAircraft &&
        !this.props.preserveView &&
        !isRecentlyRefreshed
      ) {
        console.log('Fitting bounds now');
        const bounds = L.latLngBounds(
          validAircraft.map((a) => [a.latitude, a.longitude])
        );
        this.map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 10,
        });
      }
    } catch (error) {
      console.error('[LeafletMap] Error updating aircraft:', error);
      this.props.onError('Failed to update aircraft positions');
    }
  }

  createAircraftIcon(aircraft: ExtendedAircraft, isSelected: boolean) {
    const L = this.leaflet;

    // Determine icon size based on selected state
    const size = isSelected ? 32 : 24;

    // Determine icon URL based on aircraft type and government status
    let iconUrl = '/icons/jetIconImg.png';
    if (aircraft.isGovernment) {
      iconUrl = '/icons/governmentJetIconImg.png';
    } else if (aircraft.type === 'helicopter') {
      iconUrl = '/icons/helicopterIconImg.png';
    }

    // Create the icon
    const icon = L.divIcon({
      className: `aircraft-icon ${isSelected ? 'selected' : ''} ${aircraft.on_ground ? 'grounded' : ''}`,
      html: `
        <div class="aircraft-marker" style="
          width: ${size}px; 
          height: ${size}px; 
          ${isSelected ? 'filter: drop-shadow(0 0 4px #4a80f5);' : ''}
          transition: all 300ms ease;
        ">
          <img 
            src="${iconUrl}" 
            style="
              width: 100%; 
              height: 100%; 
              transform: rotate(${aircraft.heading || 0}deg);
              transition: transform 0.3s ease;
            "
            alt="Aircraft" 
          />
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });

    return icon;
  }

  createTooltipContent(aircraft: ExtendedAircraft) {
    // Registration or N-Number display (with fallbacks)
    const registration =
      aircraft.registration || aircraft['N-NUMBER'] || aircraft.icao24;

    // Format altitude with commas for thousands
    const formattedAltitude = aircraft.altitude
      ? Math.round(aircraft.altitude).toLocaleString() + ' ft'
      : 'N/A';

    // Format speed
    const formattedSpeed = aircraft.velocity
      ? Math.round(aircraft.velocity) + ' kts'
      : 'N/A';

    return `
      <div class="p-1 min-w-[180px]">
        <div class="text-xs">${aircraft.model || aircraft.TYPE_AIRCRAFT || 'Unknown'}</div>
        <div class="grid grid-cols-2 gap-x-2 text-xs mt-1">
          <div>Alt: ${formattedAltitude}</div>
          <div>Speed: ${formattedSpeed}</div>
          ${aircraft.heading ? `<div class="col-span-2">Heading: ${Math.round(aircraft.heading)}°</div>` : ''}
          ${aircraft.manufacturer ? `<div class="col-span-2">${aircraft.manufacturer}</div>` : ''}
        </div>
      </div>
    `;
  }

  createPopupContent(aircraft: ExtendedAircraft) {
    // Registration or N-Number display (with fallbacks)
    const registration =
      aircraft.registration || aircraft['N-NUMBER'] || aircraft.icao24;

    // Format altitude with commas for thousands
    const formattedAltitude = aircraft.altitude
      ? Math.round(aircraft.altitude).toLocaleString() + ' ft'
      : 'N/A';

    // Format speed
    const formattedSpeed = aircraft.velocity
      ? Math.round(aircraft.velocity) + ' kts'
      : 'N/A';

    return `
      <div class="aircraft-popup p-2 min-w-[220px]">
        <table class="w-full text-sm border-collapse mt-2">
          <tbody>
            <tr>
              <td class="font-medium pr-2">Model:</td>
              <td>${aircraft.model || aircraft.TYPE_AIRCRAFT || 'Unknown'}</td>
            </tr>
            ${
              aircraft.manufacturer
                ? `
              <tr>
                <td class="font-medium pr-2">Manufacturer:</td>
                <td>${aircraft.manufacturer}</td>
              </tr>
            `
                : ''
            }
            <tr>
              <td class="font-medium pr-2">Altitude:</td>
              <td>${formattedAltitude}</td>
            </tr>
            <tr>
              <td class="font-medium pr-2">Speed:</td>
              <td>${formattedSpeed}</td>
            </tr>
            ${
              aircraft.heading
                ? `
              <tr>
                <td class="font-medium pr-2">Heading:</td>
                <td>${Math.round(aircraft.heading)}°</td>
              </tr>
            `
                : ''
            }
            <tr>
              <td class="font-medium pr-2">Registration:</td>
              <td>${registration}</td>
            </tr>
            <tr>
              <td class="font-medium pr-2">ICAO:</td>
              <td>${aircraft.icao24}</td>
            </tr>
            ${
              aircraft.owner
                ? `
              <tr>
                <td class="font-medium pr-2">Owner:</td>
                <td>${aircraft.owner}</td>
              </tr>
            `
                : ''
            }
            ${
              aircraft.CITY || aircraft.STATE
                ? `
              <tr>
                <td class="font-medium pr-2">Location:</td>
                <td>${[aircraft.CITY, aircraft.STATE].filter(Boolean).join(', ')}</td>
              </tr>
            `
                : ''
            }
            ${
              aircraft.OWNER_TYPE
                ? `
              <tr>
                <td class="font-medium pr-2">Owner Type:</td>
                <td>${this.getOwnerTypeLabel(aircraft.OWNER_TYPE)}</td>
              </tr>
            `
                : ''
            }
          </tbody>
        </table>
        <div class="mt-2 text-xs text-center">
          <button class="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600" onclick="this.dispatchEvent(new CustomEvent('select-aircraft', {bubbles: true}))">
            View Details
          </button>
        </div>
      </div>
    `;
  }

  // Helper function to convert owner type codes to readable labels
  getOwnerTypeLabel(ownerType: string): string {
    const ownerTypes: Record<string, string> = {
      '1': 'Individual',
      '2': 'Partnership',
      '3': 'Corporation',
      '4': 'Co-Owned',
      '5': 'Government',
      '8': 'Non-Citizen Corporation',
      '9': 'Non-Citizen Co-Owned',
    };
    return ownerTypes[ownerType] || `Type ${ownerType}`;
  }

  handleAircraftClick(aircraft: ExtendedAircraft) {
    // Update selected aircraft state
    this.setState({ selectedAircraft: aircraft });

    // If map exists, pan to the aircraft
    if (this.map && aircraft.latitude && aircraft.longitude) {
      this.map.panTo([aircraft.latitude, aircraft.longitude]);
    }

    // Update all markers to reflect the new selection
    this.updateMarkerStyles(aircraft.icao24);
  }

  updateMarkerStyles(selectedIcao24: string) {
    // Update styles for all markers
    for (const [icao24, marker] of this.markers.entries()) {
      const aircraft = this.props.aircraft.find((a) => a.icao24 === icao24);
      if (aircraft) {
        const isSelected = icao24 === selectedIcao24;
        marker.setIcon(this.createAircraftIcon(aircraft, isSelected));
        marker.setZIndexOffset(isSelected ? 1000 : 0);
      }
    }
  }

  // Clear selection when clicking elsewhere
  handleMapClick = () => {
    this.setState({ selectedAircraft: null });
    this.updateMarkerStyles('');
  };

  destroyMap() {
    if (this.map) {
      console.log('[LeafletMap] Destroying map');
      this.map.off(); // Remove event listeners
      this.map.remove(); // Destroy the map instance
      this.map = null;
      this.markerLayer = null;
      this.markers.clear();
      this.isInitialized = false;
    }

    if (this.mapRef.current) {
      this.mapRef.current.innerHTML = ''; // Ensure container is cleared
    }
  }

  render() {
    const { selectedAircraft } = this.state;
    const currentZoom = this.state.currentZoom;

    // Adjust info panel style based on zoom level
    const infoPanelStyle = {
      maxWidth: currentZoom >= 10 ? '350px' : '300px',
      maxHeight: '85vh',
      overflow: 'auto',
      transition: 'max-width 0.3s ease-in-out',
    };

    return (
      <div className="relative w-full h-full">
        <div
          ref={this.mapRef}
          className="w-full h-full"
          style={{ backgroundColor: '#f0f0f0' }}
          id="leaflet-map"
        />

        {/* Render children if the map is initialized */}
        {this.isInitialized && this.map && this.props.children}

        {/* Info panel for selected aircraft */}
        {selectedAircraft && (
          <div
            ref={this.infoRef}
            className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-30"
            style={infoPanelStyle}
          >
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl font-bold">
                {selectedAircraft.registration ||
                  selectedAircraft['N-NUMBER'] ||
                  selectedAircraft.icao24}
              </h2>
              <button
                onClick={() => this.setState({ selectedAircraft: null })}
                className="p-1 hover:bg-gray-100 rounded-full"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mb-3">
              <span className="font-medium">
                {selectedAircraft.model ||
                  selectedAircraft.TYPE_AIRCRAFT ||
                  'Unknown'}
              </span>
              {selectedAircraft.manufacturer && (
                <span className="ml-2 text-gray-600">
                  {selectedAircraft.manufacturer}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-xs text-gray-500">Altitude</div>
                <div className="font-medium">
                  {selectedAircraft.altitude
                    ? Math.round(selectedAircraft.altitude).toLocaleString() +
                      ' ft'
                    : 'N/A'}
                </div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-xs text-gray-500">Speed</div>
                <div className="font-medium">
                  {selectedAircraft.velocity
                    ? Math.round(selectedAircraft.velocity) + ' kts'
                    : 'N/A'}
                </div>
              </div>
              {selectedAircraft.heading !== undefined && (
                <div className="bg-gray-50 p-2 rounded">
                  <div className="text-xs text-gray-500">Heading</div>
                  <div className="font-medium">
                    {Math.round(selectedAircraft.heading)}°
                  </div>
                </div>
              )}
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-xs text-gray-500">ICAO24</div>
                <div className="font-medium font-mono">
                  {selectedAircraft.icao24}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-3">
              <h3 className="font-medium mb-2">Aircraft Details</h3>
              <table className="w-full text-sm">
                <tbody>
                  {(selectedAircraft.registration ||
                    selectedAircraft['N-NUMBER']) && (
                    <tr>
                      <td className="py-1 text-gray-500">Registration</td>
                      <td className="py-1 font-medium">
                        {selectedAircraft.registration ||
                          selectedAircraft['N-NUMBER']}
                      </td>
                    </tr>
                  )}
                  {selectedAircraft.owner && (
                    <tr>
                      <td className="py-1 text-gray-500">Owner</td>
                      <td className="py-1">{selectedAircraft.owner}</td>
                    </tr>
                  )}
                  {selectedAircraft.CITY && selectedAircraft.STATE && (
                    <tr>
                      <td className="py-1 text-gray-500">Location</td>
                      <td className="py-1">
                        {selectedAircraft.CITY}, {selectedAircraft.STATE}
                      </td>
                    </tr>
                  )}
                  {selectedAircraft.OWNER_TYPE && (
                    <tr>
                      <td className="py-1 text-gray-500">Owner Type</td>
                      <td className="py-1">
                        {this.getOwnerTypeLabel(selectedAircraft.OWNER_TYPE)}
                      </td>
                    </tr>
                  )}
                  {selectedAircraft.lastSeen && (
                    <tr>
                      <td className="py-1 text-gray-500">Last Seen</td>
                      <td className="py-1">
                        {new Date(
                          selectedAircraft.lastSeen
                        ).toLocaleTimeString()}
                      </td>
                    </tr>
                  )}
                  {selectedAircraft.on_ground !== undefined && (
                    <tr>
                      <td className="py-1 text-gray-500">Status</td>
                      <td className="py-1">
                        {selectedAircraft.on_ground ? (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full text-xs">
                            On Ground
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">
                            In Flight
                          </span>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {selectedAircraft.latitude && selectedAircraft.longitude && (
              <div className="mt-2 text-xs text-gray-500">
                Position: {selectedAircraft.latitude.toFixed(4)},{' '}
                {selectedAircraft.longitude.toFixed(4)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
}

export default LeafletMap;
