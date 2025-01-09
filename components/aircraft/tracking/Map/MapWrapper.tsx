import { useEffect, useState } from 'react';
import type { MapContainer as MapContainerType, TileLayer as TileLayerType } from 'react-leaflet';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

interface MapComponents {
  MapContainer: typeof MapContainerType;
  TileLayer: typeof TileLayerType;
}

export function MapWrapper() {
  const [components, setComponents] = useState<MapComponents | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMapComponents() {
      try {
        const L = await import('leaflet');
        const { MapContainer, TileLayer } = await import('react-leaflet');
        await import('leaflet/dist/leaflet.css');

        setComponents({
          MapContainer,
          TileLayer,
        });
      } catch (err) {
        console.error('Failed to load map components:', err);
        setError('Failed to load map components. Please refresh the page.');
      }
    }

    loadMapComponents();
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  if (!components) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-transparent">
        <LoadingSpinner message="" />
      </div>
    );
  }

  const { MapContainer, TileLayer } = components;

  return (
    <div className="w-full h-screen relative">
      <MapContainer
  center={[39.8283, -98.5795]} // Updated to center over the continental US
  zoom={5} // Adjust zoom level to fit the area
  className="w-full h-full"
  style={{ height: '100%', width: '100%' }}
>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
      </MapContainer>
    </div>
  );
}
