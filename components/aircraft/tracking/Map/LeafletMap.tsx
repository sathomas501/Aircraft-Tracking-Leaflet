// components/aircraft/tracking/Map/LeafletMap.tsx
import React, { Component, createRef } from 'react';
import type { ExtendedAircraft } from '@/types/base';
import { MAP_CONFIG } from '@/config/map';

interface LeafletMapProps {
  aircraft: ExtendedAircraft[];
  onError: (message: string) => void;
}

class LeafletMap extends Component<LeafletMapProps> {
  private mapRef = createRef<HTMLDivElement>();
  private map: any = null;
  private markerLayer: any = null;
  private leaflet: any = null;
  private isInitialized = false;

  componentDidMount() {
    this.initializeMap();
  }

  componentDidUpdate(prevProps: LeafletMapProps) {
    if (prevProps.aircraft !== this.props.aircraft) {
      if (!this.isInitialized) {
        this.initializeMap(); // Initialize only if needed
      }
      this.updateAircraftMarkers();
    }
  }

  componentWillUnmount() {
    console.log('[LeafletMap] Component unmounting...');
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

  updateAircraftMarkers() {
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

      console.log('[LeafletMap] Updating aircraft positions:', aircraft.length);

      // Clear existing markers
      this.markerLayer.clearLayers();

      // Filter valid aircraft
      const validAircraft = aircraft.filter(
        (plane) =>
          typeof plane.latitude === 'number' &&
          typeof plane.longitude === 'number' &&
          !isNaN(plane.latitude) &&
          !isNaN(plane.longitude)
      );

      // Add markers for each aircraft
      validAircraft.forEach((plane) => {
        const marker = L.marker([plane.latitude, plane.longitude], {
          icon: L.icon({
            iconUrl: plane.isGovernment
              ? '/icons/governmentJetIconImg.png'
              : '/icons/jetIconImg.png',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            popupAnchor: [0, -12],
          }),
        });

        // Create popup content
        const content = `
          <div class="aircraft-popup p-2">
            <h3 class="text-lg font-bold mb-2">${plane.icao24?.toUpperCase() || 'Unknown'}</h3>
            <div class="text-sm space-y-1">
              <p><span class="font-semibold">Model:</span> ${plane.model || 'Unknown'}</p>
              <p><span class="font-semibold">Type:</span> ${plane.type || 'Unknown'}</p>
              <p><span class="font-semibold">Altitude:</span> ${Math.round(plane.altitude || 0)} ft</p>
              <p><span class="font-semibold">Speed:</span> ${Math.round(plane.velocity || 0)} knots</p>
              <p><span class="font-semibold">Heading:</span> ${Math.round(plane.heading || 0)}°</p>
              ${plane['N-NUMBER'] ? `<p><span class="font-semibold">N-Number:</span> ${plane['N-NUMBER']}</p>` : ''}
            </div>
          </div>
        `;

        marker.bindPopup(content);
        this.markerLayer.addLayer(marker);
      });

      // Auto-fit bounds if we have aircraft
      if (validAircraft.length > 0) {
        const bounds = L.latLngBounds(
          validAircraft.map((a) => [a.latitude, a.longitude])
        );
        this.map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 10, // Prevent too much zoom
        });
      }
    } catch (error) {
      console.error('[LeafletMap] Error updating aircraft:', error);
      this.props.onError('Failed to update aircraft positions');
    }
  }

  destroyMap() {
    if (this.map) {
      console.log('[LeafletMap] Destroying map');
      this.map.off(); // Remove event listeners
      this.map.remove(); // Destroy the map instance
      this.map = null;
      this.markerLayer = null;
      this.isInitialized = false;
    }

    if (this.mapRef.current) {
      this.mapRef.current.innerHTML = ''; // Ensure container is cleared
    }
  }

  render() {
    return (
      <div
        ref={this.mapRef}
        className="w-full h-full"
        style={{ backgroundColor: '#f0f0f0' }}
        id="leaflet-map"
      />
    );
  }
}

export default LeafletMap;
